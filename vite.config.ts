import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fetchBingWallpaper } from "./src/server/bingWallpaper";
import { fetchLinkMetadata } from "./src/server/linkMetadata";

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
      },
    },
  ],
});
