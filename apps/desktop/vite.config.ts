import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { tauriMockPlugin } from "./e2e/fixtures/vite-tauri-mock-plugin";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    mode === "e2e" && tauriMockPlugin(),
  ].filter(Boolean),
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  envPrefix: ["VITE_", "TAURI_"],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  build: {
    target: "esnext",
    minify: "esbuild",
    sourcemap: true,
  },
}));
