import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

// 开发时前端 5173，/api 转发给内置后端 8787；生产时由后端直接托管 dist
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    // @shared 要排在 @ 前面，避免 "@shared/x" 被当成 "@…/x" 先匹配
    alias: [
      { find: "@shared", replacement: fileURLToPath(new URL("./shared", import.meta.url)) },
      { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) }
    ]
  },
  server: { port: 5173, proxy: { "/api": "http://127.0.0.1:8787" } },
});
