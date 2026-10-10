import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/revenuecat.js",
      formats: ["es"],
      fileName: () => "revenuecat.js",
    },
    outDir: "web",
    emptyOutDir: false,
  },
});
