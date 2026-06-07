import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      module: path.resolve(__dirname, "src/shims/module.ts"),
    },
  },
  server: {
    port: 5175,
  },
});
