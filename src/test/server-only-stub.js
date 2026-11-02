// Stands in for the `server-only` package under vitest.
//
// The real module throws on import outside a React Server Component, which is
// correct for the app and made every CRM module — leads, quotations, payments,
// the code that moves money — impossible to unit test. The alias lives in
// vitest.config.mjs, so the production build still gets the real guard.
export {};
