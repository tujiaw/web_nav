import { fetchLinkMetadata } from "../src/server/linkMetadata";

type ApiRequest = {
  method?: string;
  query: Record<string, string | string[] | undefined>;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");

  if (request.method && request.method !== "GET") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  const rawUrl = request.query.url;
  const url = Array.isArray(rawUrl) ? rawUrl[0] : rawUrl;

  if (!url) {
    response.status(400).json({ error: "Missing url" });
    return;
  }

  try {
    response.status(200).json(await fetchLinkMetadata(url));
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "Fetch failed" });
  }
}
