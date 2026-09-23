import { defineConfig } from "vitest/config";
import path from "path";

// Minimal config: just enough to run the pure-logic unit tests under
// lib/__tests__ with the same "@/..." import alias the app uses (see
// tsconfig.json paths). Deliberately not pulling in the Next.js/React
// plugin - these tests exercise plain TypeScript functions, not components.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["**/__tests__/**/*.test.ts"],
  },
});
