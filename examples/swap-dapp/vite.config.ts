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
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/wasmoon")) {
            return "lua-engine";
          }

          if (id.includes("node_modules/ethers")) {
            return "ethers-vendor";
          }

          if (
            id.includes("/packages/core/") ||
            id.includes("/packages/react/") ||
            id.includes("/packages/runtime-intercept/")
          ) {
            return "lunatest-vendor";
          }

          if (id.includes("node_modules/react")) {
            return "react-vendor";
          }

          return undefined;
        },
      },
    },
  },
  server: {
    port: 5174,
  },
});
