// Collection dates are entered as DD-MM-YYYY (day first, always) but
// stored as ISO (YYYY-MM-DD) in Postgres — a `date` column with a
// dash-separated non-ISO string is ambiguous (e.g. "05-09-2026" could be
// read as day=05 or month=05 depending on server settings), so the
// conversion happens explicitly here rather than trusting Postgres to
// guess. The separator between the three parts is flexible — a hyphen,
// slash, backslash, comma, or period are all accepted (and need not
// match each other within one date) — since that's just typing
// convenience; the DD-MM-YYYY part order itself never changes.
const SEPARATOR = String.raw`[-/\\.,]`;
const DATE_PATTERN = new RegExp(`^(\\d{2})${SEPARATOR}(\\d{2})${SEPARATOR}(\\d{4})$`);

export const DATE_FORMAT_LABEL = "DD-MM-YYYY";

// A longer hint for instructional copy (import/template dialogs) — same
// format, spelling out which separators are accepted.
export const DATE_FORMAT_HELP = "DD-MM-YYYY (separators -, /, \\, comma, or period are all fine)";

// Returns the equivalent ISO date (YYYY-MM-DD) if `value` is a valid
// DD-MM-YYYY date — with any of -, /, \, comma, or period as the
// separator — or null if it isn't (wrong shape, or a date that doesn't
// exist, like 31-02-2026).
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

// Converts an ISO date (as read back from Postgres) to DD-MM-YYYY — the
// canonical, parseable shape parseDDMMYYYY above always accepts — for
// seeding an editable date Input's value (an edit dialog, or a table's
// edit-mode cell). For read-only display, use formatDateDisplay in
// date-format.ts instead, which spells the month out (e.g. "01 Oct
// 2021") so there's no day/month ambiguity to a reader. Passes through
// unrecognized input rather than throwing.
export function formatToDDMMYYYY(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return isoDate;
  const [, yyyy, mm, dd] = match;
  return `${dd}-${mm}-${yyyy}`;
}
