import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

// The UI is a thin client over the engine: it imports `../engine` and renders the
// result. The engine never imports anything from here (see `npm run typecheck`).
export default defineConfig({
  root: "ui",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
  // The preview server (and the dev server) must be reachable on IPv4: Playwright's
  // `webServer.url` polls `127.0.0.1`, and a preview server that binds only `::1`
  // answers on one address family while the wait is knocking on the other.
  preview: {
    host: "127.0.0.1",
  },
  // Expose the Vercel build environment so the app can gate analytics injection.
  // On Vercel, VERCEL=1 is set automatically; in local dev and CI preview it is
  // absent, so the analytics <script> is never appended and there is no 404.
  define: {
    "import.meta.env.VERCEL": JSON.stringify(process.env.VERCEL ?? ""),
  },
});
