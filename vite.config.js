import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";

const rootDir = path.resolve(__dirname, "frontend");
const proxyTarget = process.env.VITE_API_PROXY_TARGET || "http://localhost:3000";

export default defineConfig({
  root: rootDir,
  plugins: [vue()],
  base: "/",
  publicDir: path.resolve(rootDir, "public"),
  build: {
    outDir: path.resolve(rootDir, "dist"),
    emptyOutDir: true
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": proxyTarget,
      "/events": {
        target: proxyTarget,
        changeOrigin: true,
        ws: false
      },
      "/evidence": proxyTarget
    }
  }
});
