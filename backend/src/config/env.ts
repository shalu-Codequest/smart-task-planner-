/**
 * Centralized runtime configuration.
 *
 * Keeping configuration in one module makes it easier to audit and adjust.
 */
export const config = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  nodeEnv: process.env.NODE_ENV ?? 'development',

  /**
   * Whether to include internal error messages in 500 responses.
   *
   * Fails closed: true only when NODE_ENV is explicitly 'development'.
   * Defaulting `nodeEnv` to 'development' is convenient for local work, but if
   * that default also gated error disclosure, an operator who forgot to set
   * NODE_ENV in production would silently be leaking stack messages. The
   * default for a security control must be the safe one, not the convenient one.
   */
  exposeInternalErrors: process.env.NODE_ENV === 'development',
} as const;
