import { createClient } from "@supabase/supabase-js";

type ApiRequest = { method?: string; headers: { authorization?: string } };
type ApiResponse = { status: (code: number) => ApiResponse; json: (body: unknown) => void };

export default async function handler(request: ApiRequest, response: ApiResponse) {
  if (request.method && request.method !== "GET") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.authorization !== `Bearer ${cronSecret}`) {
    response.status(401).json({ error: "Unauthorized" });
    return;
  }

  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    response.status(500).json({ error: "Missing server-side Supabase configuration" });
    return;
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  let removedItems = 0;
  let removedFiles = 0;

  try {
    for (;;) {
      const { data, error } = await supabase
        .from("drop_items")
        .select("id,file_path")
        .lte("expires_at", new Date().toISOString())
        .limit(100);
      if (error) throw error;
      if (!data?.length) break;

      const paths = data.flatMap((item) => item.file_path ? [item.file_path] : []);
      if (paths.length) {
        const { error: storageError } = await supabase.storage.from("drop-files").remove(paths);
        if (storageError) throw storageError;
        removedFiles += paths.length;
      }

      const { error: deleteError } = await supabase.from("drop_items").delete().in("id", data.map((item) => item.id));
      if (deleteError) throw deleteError;
      removedItems += data.length;
    }

    response.status(200).json({ removedItems, removedFiles });
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : "Drop cleanup failed", removedItems, removedFiles });
  }
}
