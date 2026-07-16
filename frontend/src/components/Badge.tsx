import type { ReactNode } from 'react';

/**
 * A small labelled pill.
 *
 * Extracted because priority, status, effort, and category badges appear on the
 * card, in the detail panel, and in the plan entries. Three near-identical span
 * elements with slightly different Tailwind strings is how a codebase ends up with
 * three slightly different visual languages.
 */
export function Badge({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

/** A badge with a ring -- used for priority, where the distinction should carry. */
export function RingBadge({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  );
}
