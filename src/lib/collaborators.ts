// Collaborators are stored as a single free-text, comma-separated field
// rather than a separate table — simplest thing that works for "a few
// names," with no need for its own add/remove UI. Split for display only.
export function parseCollaborators(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}
