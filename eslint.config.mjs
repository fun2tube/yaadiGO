import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import globals from "globals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),

  /**
   * no-undef.
   *
   * `core-web-vitals` does not enable this, and the gap cost us the revenue
   * chain: an API route passed `{ actor }` where the variable in scope was
   * `user`, so **approving a quotation threw a 500 and never created the
   * booking.** Every other call in the same file said `{ actor: user }`. Lint
   * was clean, the tests were green, and only running the flow end to end found
   * it — a reference to a variable that does not exist is the cheapest possible
   * bug to catch and we were not catching it.
   *
   * The globals have to be declared or this floods on `process`, `fetch`,
   * `console` and `window`. Both sets are listed because this codebase runs
   * server and client code side by side, frequently in the same directory.
   */
  {
    files: ["**/*.{js,mjs,jsx,ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      "no-undef": "error",
    },
  },
]);

export default eslintConfig;
