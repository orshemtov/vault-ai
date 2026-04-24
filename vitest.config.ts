import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@agents": path.resolve(__dirname, "src/agents"),
      "@app": path.resolve(__dirname, "src/app"),
      "@commands": path.resolve(__dirname, "src/commands"),
      "@core": path.resolve(__dirname, "src/core"),
      "@providers": path.resolve(__dirname, "src/providers"),
      "@retrieval": path.resolve(__dirname, "src/retrieval"),
      "@scheduler": path.resolve(__dirname, "src/scheduler"),
      "@skills": path.resolve(__dirname, "src/skills"),
      "@storage": path.resolve(__dirname, "src/storage"),
      "@tools": path.resolve(__dirname, "src/tools"),
      "@ui": path.resolve(__dirname, "src/ui")
    }
  },
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"]
  }
});
