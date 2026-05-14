/**
 * Dev-only logger. No-op in production builds.
 *
 * Use `dlog` for chatty diagnostics that should NOT appear in user-facing
 * production consoles. Genuine errors and warnings should keep using
 * `console.error` / `console.warn` so they always surface.
 */
export const dlog = (...args: unknown[]): void => {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
};
