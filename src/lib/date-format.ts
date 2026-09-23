const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

// The Detailed view's "Date" columns are a plain text field typed as
// dd/mm/yyyy directly, so most values need no conversion — this only
// exists to reformat the yyyy-mm-dd shape a "Date" column stored before it
// used a native `<input type="date">`, so any values entered that way
// still read correctly. Anything else (free-typed text, empty) is left
// as-is.
export function formatDateDMY(value: string): string {
  const match = value.match(ISO_DATE);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}
