/**
 * Whole years between a YYYY-MM-DD birth date and now.
 *
 * Pure and dependency-free so both the report pipeline and the chat prompt can
 * derive an age from the same arithmetic instead of each carrying its own copy.
 * Returns 0 for a missing or unparseable date — callers treat 0 as "unknown"
 * rather than as a newborn.
 */
export function ageInYears(
  date: string | null | undefined,
  now: Date = new Date()
): number {
  const [y, m, d] = String(date ?? "")
    .split("-")
    .map(Number);
  if (!y || !m || !d) return 0;

  const beforeBirthday =
    now.getUTCMonth() + 1 < m ||
    (now.getUTCMonth() + 1 === m && now.getUTCDate() < d);

  return Math.max(0, now.getUTCFullYear() - y - (beforeBirthday ? 1 : 0));
}
