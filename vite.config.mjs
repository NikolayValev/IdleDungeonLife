import { defineConfig } from "vite";

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/phaser")) {
            return "phaser";
          }
          if (id.includes("/src/content/")) {
            return "content";
          }
          if (id.includes("/src/ui/scenes/")) {
            return "ui-scenes";
          }
          if (id.includes("/src/core/") || id.includes("/src/sim/")) {
            return "core-sim";
          }
          return undefined;
        },
      },
    },
  },
});
