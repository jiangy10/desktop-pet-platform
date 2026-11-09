import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { port: 5173, strictPort: true },
  build: {
    rollupOptions: {
      input: {
        pet: resolve(__dirname, "pet.html"),
        editor: resolve(__dirname, "editor.html"),
      },
    },
  },
  test: { include: ["src/**/*.test.ts"] },
} as import("vite").UserConfig);
