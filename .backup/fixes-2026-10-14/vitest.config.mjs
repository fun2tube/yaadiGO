import { defineConfig } from "vitest/config";
import { transformWithOxc } from "vite";
import { fileURLToPath } from "node:url";

/**
 * JSX inside `.js` files.
 *
 * Next compiles JSX in `.js` happily; the test bundler does not. Vite decides
 * a file's language from its extension, so every page and component in this
 * project — all of which are `.js` — failed to parse the moment a test
 * imported one. That is why the panels had no coverage at all, and why a
 * screen could pass a full green run while throwing on the first real request.
 *
 * Vite 8 runs on Rolldown, where the old `esbuild` transform option no longer
 * applies, so this calls oxc directly on the files that need it. Guarded two
 * ways: only our own `src/` files, and only ones that actually look like they
 * contain JSX, so the transform never runs over plain modules or dependencies.
 */
const jsxInJs = {
  name: "yaadigo:jsx-in-js",
  async transform(code, id) {
    const file = id.split("?")[0];
    if (!file.includes("/src/") || !file.endsWith(".js")) return null;
    // Cheap pre-check: an opening tag or a fragment. Wrong only in the safe
    // direction — a false positive is a redundant transform, not a failure.
    if (!/<[A-Za-z][\w.-]*[\s/>]|<>/.test(code)) return null;

    const result = await transformWithOxc(code, file, { lang: "jsx", jsx: { runtime: "automatic" } });
    return { code: result.code, map: result.map };
  },
};

export default defineConfig({
  plugins: [jsxInJs],

  test: {
    // Domain logic, plus server-component smoke tests over every admin panel.
    // Client components still need a DOM and are not covered here.
    include: ["src/**/*.test.{js,ts}"],
    environment: "node",
  },

  resolve: {
    alias: {
      // `@/…` is what the app uses; vitest needs to be told.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws by design when imported outside a React Server
      // Component, which made every CRM module untestable — and the CRM
      // modules are exactly the ones that move money. Stubbed so the guard
      // still protects the app build while the logic can be tested.
      "server-only": fileURLToPath(new URL("./src/test/server-only-stub.js", import.meta.url)),
    },
  },
});
