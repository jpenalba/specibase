// Continues a spreadsheet-style "PREFIX0001" series the way a fill-handle
// drag does: only the trailing run of digits advances, padded to its
// original width (or wider, if the increment overflows it); anything
// before those digits — including a non-numeric prefix — is left as-is.
// A value with no trailing digits has nothing to advance, so it's repeated
// unchanged, matching spreadsheet behavior for a plain-text fill.
const TRAILING_NUMBER = /^(.*?)(\d+)$/;

export function incrementSeriesValue(value: string, offset: number): string {
  const match = value.match(TRAILING_NUMBER);
  if (!match) return value;
  const [, prefix, digits] = match;
  const next = Number(digits) + offset;
  if (next < 0) return value;
  return `${prefix}${String(next).padStart(digits.length, "0")}`;
}
