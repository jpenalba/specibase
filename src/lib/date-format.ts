const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

// The Detailed view's "Date" columns store whatever a native
// `<input type="date">` gives on edit (always yyyy-mm-dd, regardless of
// locale) but should read as dd/mm/yyyy once locked — this only reformats
// that one shape and leaves anything else (free-typed text, empty) as-is.
export function formatDateDMY(value: string): string {
  const match = value.match(ISO_DATE);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}
