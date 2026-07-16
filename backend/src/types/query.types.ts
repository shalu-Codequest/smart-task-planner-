import type { Priority, Status } from './task.types.js';

/**
 * Filters accepted by `GET /tasks`.
 *
 * Every field is optional and they compose with AND semantics.
 *
 * This lives in the domain types rather than the controller because "what does
 * a search match against?" is a business question, and the service needs to be
 * able to answer it without knowing that query strings exist.
 */
export interface TaskFilters {
  /** Case-insensitive substring match against title and description. */
  search?: string;
  priority?: Priority;
  status?: Status;
  category?: string;
}
