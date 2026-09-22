import { CitationAuthor, CitationMetadata } from "./citation-metadata";

// "Jane Marie" -> "J. M." — APA uses initials, not full given names.
function initials(given: string | undefined): string {
  if (!given) return "";
  return given
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}.`)
    .join(" ");
}

function formatAuthorName(author: CitationAuthor): string {
  const init = initials(author.given);
  return init ? `${author.family}, ${init}` : author.family;
}

// APA 7: "A", "A & B", "A, B, & C", ... up to 20 authors listed in full;
// 21+ lists the first 19, an ellipsis, then the final author.
export function formatAuthorList(authors: CitationAuthor[]): string {
  const names = authors.map(formatAuthorName);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]}, & ${names[1]}`;
  if (names.length <= 20) {
    return `${names.slice(0, -1).join(", ")}, & ${names[names.length - 1]}`;
  }
  return `${names.slice(0, 19).join(", ")}, ... ${names[names.length - 1]}`;
}

// Drives the reference list's alphabetical sort — the first author's
// surname, falling back to the title for a no-author work (e.g. a report
// credited to an organization Crossref didn't structure as an author).
export function firstAuthorSortKey(metadata: CitationMetadata): string {
  const surname = metadata.authors[0]?.family;
  return (surname || metadata.title || "").toLowerCase();
}

// Renders as markdown (the *italics* below) since the References section
// shows every citation through the same markdown renderer already used
// for Background/Notes.
export function formatApaCitation(metadata: CitationMetadata): string {
  const authorPart = formatAuthorList(metadata.authors);
  const yearPart = metadata.year ? `(${metadata.year}).` : "(n.d.).";
  const title = metadata.title.trim();
  const titlePart = title.endsWith(".") ? title : `${title}.`;

  const leading = authorPart
    ? `${authorPart} ${yearPart} ${titlePart}`
    : `${titlePart} ${yearPart}`;

  let journalPart = "";
  if (metadata.journal) {
    journalPart = ` *${metadata.journal}*`;
    if (metadata.volume) {
      journalPart += `, *${metadata.volume}*`;
      if (metadata.issue) journalPart += `(${metadata.issue})`;
    }
    if (metadata.pages) journalPart += `, ${metadata.pages}`;
    journalPart += ".";
  }

  const doiPart = metadata.doi ? ` https://doi.org/${metadata.doi}` : "";

  return `${leading}${journalPart}${doiPart}`.replace(/[ \t]+/g, " ").trim();
}
