import path from "node:path";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const ROOT = path.resolve(".");

const SHIMS: Record<string, string> = {
  "src/lib/market/quotes.ts": "src/lib/market/quotes-pages.ts",
};

function pagesShims(): Plugin {
  return {
    name: "nexora-pages-shims",
    enforce: "pre",
    async resolveId(id, importer) {
      if (id.includes("\0")) return null;
      const resolved = await this.resolve(id, importer, { skipSelf: true });
      if (!resolved) return null;
      const norm = resolved.id.replace(/\\/g, "/");
      for (const [from, to] of Object.entries(SHIMS)) {
        if (norm.endsWith("/" + from) || norm.endsWith(from)) {
          return path.resolve(ROOT, to);
        }
      }
      return null;
    },
  };
}

export default defineConfig({
  base: "./",
  root: path.resolve("pages"),
  publicDir: path.resolve("public"),
  envDir: ROOT,
  plugins: [pagesShims(), tailwindcss(), viteReact()],
  resolve: { tsconfigPaths: true, alias: { "@": path.resolve("src") } },
  define: {
    "import.meta.env.VITE_AUTH_ENABLED": JSON.stringify("true"),
    "import.meta.env.VITE_PAGES": JSON.stringify("1"),
  },
  build: {
    outDir: path.resolve("docs"),
    emptyOutDir: true,
    assetsDir: "assets",
  },
});
