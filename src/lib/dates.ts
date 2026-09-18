// Collection dates are entered and displayed as DD-MM-YYYY everywhere in
// the app, but stored as ISO (YYYY-MM-DD) in Postgres — a `date` column
// with a dash-separated non-ISO string is ambiguous (e.g. "05-09-2026"
// could be read as day=05 or month=05 depending on server settings), so
// the conversion happens explicitly here rather than trusting Postgres
// to guess.

const DATE_PATTERN = /^(\d{2})-(\d{2})-(\d{4})$/;

export const DATE_FORMAT_LABEL = "DD-MM-YYYY";

// Returns the equivalent ISO date (YYYY-MM-DD) if `value` is a valid
// DD-MM-YYYY date, or null if it isn't (wrong shape, or a date that
// doesn't exist, like 31-02-2026).
export function parseDDMMYYYY(value: string): string | null {
  const match = DATE_PATTERN.exec(value.trim());
  if (!match) return null;

  const [, dd, mm, yyyy] = match;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);

  const date = new Date(Date.UTC(year, month - 1, day));
  const roundTrips =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;

  return roundTrips ? `${yyyy}-${mm}-${dd}` : null;
}

// Converts an ISO date (as read back from Postgres) to DD-MM-YYYY for
// display. Passes through unrecognized input rather than throwing.
export function formatToDDMMYYYY(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return isoDate;
  const [, yyyy, mm, dd] = match;
  return `${dd}-${mm}-${yyyy}`;
}
