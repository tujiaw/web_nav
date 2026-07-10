import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { organizeNavigationWithAi } from "./src/server/aiOrganize";
import { fetchBingWallpaper } from "./src/server/bingWallpaper";
import { fetchIconUrlOnly, fetchLinkMetadata } from "./src/server/linkMetadata";

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (id.includes("@radix-ui")) {
            return "radix";
          }

          if (id.includes("@supabase")) {
            return "supabase";
          }

          if (id.includes("react") || id.includes("react-dom")) {
            return "react";
          }

          return undefined;
        },
      },
    },
  },
  plugins: [
    react(),
    {
      name: "local-link-metadata-api",
      configureServer(server) {
        server.middlewares.use("/api/link-metadata", async (request, response) => {
          const requestUrl = new URL((request as { url?: string }).url ?? "", "http://localhost");
          const url = requestUrl.searchParams.get("url");

          response.setHeader("Content-Type", "application/json");

          if (!url) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: "Missing url" }));
            return;
          }

          try {
            response.end(JSON.stringify(await fetchLinkMetadata(url)));
          } catch (error) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Fetch failed" }));
          }
        });

        server.middlewares.use("/api/batch-icon-urls", async (request, response) => {
          response.setHeader("Content-Type", "application/json");

          if (request.method !== "POST") {
            response.statusCode = 405;
            response.end(JSON.stringify({ error: "Method not allowed" }));
            return;
          }

          let rawBody = "";
          request.on("data", (chunk) => {
            rawBody += chunk;
          });
          request.on("end", async () => {
            try {
              const { urls } = JSON.parse(rawBody) as { urls?: string[] };
              if (!urls || !Array.isArray(urls)) {
                response.statusCode = 400;
                response.end(JSON.stringify({ error: "Missing urls array" }));
                return;
              }

              const settled = await Promise.allSettled(
                urls.map(async (url) => ({ url, iconUrl: await fetchIconUrlOnly(url) })),
              );
              const results: Record<string, string> = {};
              for (const item of settled) {
                if (item.status === "fulfilled") {
                  results[item.value.url] = item.value.iconUrl;
                }
              }

              response.end(JSON.stringify({ results }));
            } catch (error) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Batch fetch failed" }));
            }
          });
        });

        server.middlewares.use("/api/bing-wallpaper", async (_request, response) => {
          response.setHeader("Content-Type", "application/json");
          response.setHeader("Cache-Control", "max-age=86400");

          try {
            response.end(JSON.stringify(await fetchBingWallpaper()));
          } catch (error) {
            response.statusCode = 502;
            response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Fetch failed" }));
          }
        });

        server.middlewares.use("/api/ai-organize", async (request, response) => {
          response.setHeader("Content-Type", "application/json");
          response.setHeader("Cache-Control", "no-store");

          if (request.method !== "POST") {
            response.statusCode = 405;
            response.end(JSON.stringify({ error: "Method not allowed" }));
            return;
          }

          let rawBody = "";
          request.on("data", (chunk) => {
            rawBody += chunk;
          });
          request.on("end", async () => {
            try {
              response.end(JSON.stringify({ items: await organizeNavigationWithAi(JSON.parse(rawBody)) }));
            } catch (error) {
              response.statusCode = 400;
              response.end(JSON.stringify({ error: error instanceof Error ? error.message : "AI organize failed" }));
            }
          });
        });
      },
    },
  ],
});
