import axios, { AxiosError } from 'axios';

import { ErrorCode } from '../types/api.types';
import type { ApiErrorResponse } from '../types/api.types';
import { ApiError, fromEnvelope, networkError } from './ApiError';

/**
 * The HTTP boundary.
 *
 * This is the only file in the frontend that imports Axios.
 *
 * Everything above it -- the request functions, the context, every component --
 * deals in domain types and `ApiError`. That containment is what keeps the HTTP
 * client an implementation detail rather than a dependency of the whole app.
 * Swapping Axios for fetch would touch this file and nothing else.
 *
 * The response interceptor is the mechanism: it catches every AxiosError,
 * converts it to an ApiError, and re-throws. By the time a rejection reaches a
 * caller, the Axios shape is gone.
 */
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:4000',
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
});

client.interceptors.response.use(
  (response) => response,

  (error: unknown) => {
    // --- The server responded with an error status ---------------------------
    if (axios.isAxiosError(error) && error.response) {
      const body = (error.response.data as ApiErrorResponse | undefined)?.error;

      if (body?.code) {
        // The happy path for errors: our own envelope. Every backend failure -- a
        // Zod issue, a cycle, a blocked delete -- arrives here fully typed.
        return Promise.reject(fromEnvelope(body, error.response.status));
      }

      // The server responded, but not in our envelope. Something is wrong that is
      // not a domain error -- a proxy, a crash before the error handler ran, an
      // HTML 500 page. Do not pretend it is a normal failure.
      return Promise.reject(
        new ApiError(
          ErrorCode.INTERNAL_ERROR,
          `Unexpected response from the server (HTTP ${error.response.status}).`,
          error.response.status,
        ),
      );
    }

    // --- The request never reached the server -------------------------------
    // Backend down, wrong port, CORS rejection, timeout. Distinct from a 4xx:
    // nothing was validated and nothing was refused. The message must not imply
    // the user's input was at fault.
    if (error instanceof AxiosError) {
      return Promise.reject(networkError());
    }

    // Genuinely unexpected -- a bug in our own interceptor chain, most likely.
    return Promise.reject(
      new ApiError(ErrorCode.INTERNAL_ERROR, 'An unexpected error occurred.', 0),
    );
  },
);

export default client;
