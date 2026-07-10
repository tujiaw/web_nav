import { organizeNavigationWithAi } from "../src/server/aiOrganize";

type ApiRequest = {
  body?: unknown;
  method?: string;
};

type ApiResponse = {
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method && request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    response.status(200).json({ items: await organizeNavigationWithAi(request.body as never) });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : "AI organize failed" });
  }
}
