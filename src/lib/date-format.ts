const DMY_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const MONTH_ABBREVIATIONS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// The Detailed view's "Date" columns are entered as dd/mm/yyyy (unambiguous
// to type) but read as "01 Jan 1970" once locked, so nobody has to guess
// whether a bare numeric date is day-first or month-first. Also accepts
// the yyyy-mm-dd shape a "Date" column stored before it was a plain text
// field, so anything entered that way still reads correctly. Anything
// else (free-typed text, empty, a value still mid-edit) is left as-is.
export function formatDateDisplay(value: string): string {
  const dmy = value.match(DMY_DATE);
  if (dmy) {
    const [, day, month, year] = dmy;
    return formatParts(day, month, year);
  }
  const iso = value.match(ISO_DATE);
  if (iso) {
    const [, year, month, day] = iso;
    return formatParts(day, month, year);
  }
  return value;
}

function formatParts(day: string, month: string, year: string): string {
  const monthIndex = Number(month) - 1;
  const monthName = MONTH_ABBREVIATIONS[monthIndex];
  if (!monthName) return `${day}/${month}/${year}`;
  return `${day.padStart(2, "0")} ${monthName} ${year}`;
}

// A Bioinformatic-notes block's "written on" date, auto-set from its
// created_at timestamp — the same "01 Jan 1970" style as
// formatDateDisplay, read in the viewer's local time zone since that's
// the calendar day they'd recognize as "when I wrote this".
export function formatTimestampDisplay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = String(date.getDate()).padStart(2, "0");
  const monthName = MONTH_ABBREVIATIONS[date.getMonth()];
  return `${day} ${monthName} ${date.getFullYear()}`;
}
