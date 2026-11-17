/** `db.execute` returns an array (postgres-js) or `{ rows }` (PGlite); normalise. */
export function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  return ((result as { rows?: T[] }).rows ?? []) as T[];
}
