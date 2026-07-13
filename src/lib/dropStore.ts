import { supabase } from "./supabase";

export type DropItem = {
  id: string;
  userId: string;
  kind: "text" | "file";
  content: string;
  fileName: string | null;
  filePath: string | null;
  fileSize: number | null;
  mimeType: string | null;
  createdAt: string;
  expiresAt: string;
};

export type DropSettings = {
  retentionDays: 1 | 7 | 30 | 90;
  maxFileSizeMb: 5 | 10 | 20;
  compactMode: boolean;
  confirmBeforeDelete: boolean;
};

type DropRow = {
  id: string;
  user_id: string;
  kind: "text" | "file";
  content: string | null;
  file_name: string | null;
  file_path: string | null;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
  expires_at: string;
};

export const defaultDropSettings: DropSettings = {
  retentionDays: 30,
  maxFileSizeMb: 20,
  compactMode: false,
  confirmBeforeDelete: true,
};

const bucket = "drop-files";
const settingsKey = "drop-settings";
const selectColumns = "id,user_id,kind,content,file_name,file_path,file_size,mime_type,created_at,expires_at";

function mapItem(row: DropRow): DropItem {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    content: row.content ?? "",
    fileName: row.file_name,
    filePath: row.file_path,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

function expirationDate(retentionDays: number) {
  return new Date(Date.now() + retentionDays * 86_400_000).toISOString();
}

function safeFileName(name: string) {
  return Array.from(name.normalize("NFKC"), (character) => {
    const code = character.charCodeAt(0);
    return character === "/" || character === "\\" || code < 32 ? "_" : character;
  }).join("").slice(0, 180) || "file";
}

export async function loadDropItems(userId: string) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("drop_items")
    .select(selectColumns)
    .eq("user_id", userId)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as DropRow[]).map(mapItem);
}

export async function addDropText(userId: string, content: string, retentionDays: number) {
  if (!supabase) throw new Error("Supabase 未配置");
  const { data, error } = await supabase
    .from("drop_items")
    .insert({ user_id: userId, kind: "text", content: content.trim(), expires_at: expirationDate(retentionDays) })
    .select(selectColumns)
    .single();
  if (error) throw error;
  return mapItem(data as DropRow);
}

export async function addDropFile(userId: string, file: File, retentionDays: number) {
  if (!supabase) throw new Error("Supabase 未配置");
  const id = crypto.randomUUID();
  const fileName = safeFileName(file.name);
  const filePath = `${userId}/${id}/${fileName}`;
  const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file, {
    cacheControl: "3600",
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("drop_items")
    .insert({
      id,
      user_id: userId,
      kind: "file",
      file_name: fileName,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type || "application/octet-stream",
      expires_at: expirationDate(retentionDays),
    })
    .select(selectColumns)
    .single();
  if (error) {
    await supabase.storage.from(bucket).remove([filePath]);
    throw error;
  }
  return mapItem(data as DropRow);
}

export async function downloadDropFile(item: DropItem) {
  if (!supabase || !item.filePath) return;
  const { data, error } = await supabase.storage.from(bucket).download(item.filePath);
  if (error) throw error;
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = item.fileName ?? "download";
  link.click();
  URL.revokeObjectURL(url);
}

export async function getDropFileUrl(item: DropItem) {
  if (!supabase || !item.filePath) return "";
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(item.filePath, 300);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteDropItem(item: DropItem) {
  if (!supabase) return;
  if (item.filePath) {
    const { error: fileError } = await supabase.storage.from(bucket).remove([item.filePath]);
    if (fileError) throw fileError;
  }
  const { error } = await supabase.from("drop_items").delete().eq("id", item.id);
  if (error) throw error;
}

export async function clearDropItems(items: DropItem[]) {
  if (!supabase || items.length === 0) return;
  for (let index = 0; index < items.length; index += 100) {
    const batch = items.slice(index, index + 100);
    const paths = batch.flatMap((item) => item.filePath ? [item.filePath] : []);
    if (paths.length) {
      const { error } = await supabase.storage.from(bucket).remove(paths);
      if (error) throw error;
    }
    const { error } = await supabase.from("drop_items").delete().in("id", batch.map((item) => item.id));
    if (error) throw error;
  }
}

export async function loadDropSettings(userId: string) {
  if (!supabase) return defaultDropSettings;
  const { data, error } = await supabase
    .from("user_configs")
    .select("value")
    .eq("user_id", userId)
    .eq("key", settingsKey)
    .maybeSingle();
  if (error) throw error;
  const saved = (data?.value ?? {}) as Partial<DropSettings>;
  const retentionDays = [1, 7, 30, 90].includes(Number(saved.retentionDays))
    ? Number(saved.retentionDays) as DropSettings["retentionDays"]
    : defaultDropSettings.retentionDays;
  return {
    retentionDays,
    maxFileSizeMb: [5, 10, 20].includes(Number(saved.maxFileSizeMb))
      ? Number(saved.maxFileSizeMb) as DropSettings["maxFileSizeMb"]
      : defaultDropSettings.maxFileSizeMb,
    compactMode: typeof saved.compactMode === "boolean" ? saved.compactMode : defaultDropSettings.compactMode,
    confirmBeforeDelete: typeof saved.confirmBeforeDelete === "boolean" ? saved.confirmBeforeDelete : defaultDropSettings.confirmBeforeDelete,
  };
}

export async function saveDropSettings(userId: string, settings: DropSettings) {
  if (!supabase) return;
  const { error } = await supabase.from("user_configs").upsert({
    user_id: userId,
    key: settingsKey,
    value: settings,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,key" });
  if (error) throw error;
}
