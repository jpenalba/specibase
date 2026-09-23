export type EntryStatus = "not_started" | "in_progress" | "done" | "failed";

// Left-click cycle in the Simple grid — "failed" is deliberately excluded
// (it's only reachable via right-click) so an ordinary click never lands
// on it by accident. Clicking a failed cell restarts the cycle at "grey".
const CLICK_CYCLE: EntryStatus[] = ["not_started", "in_progress", "done"];

export function nextStatus(current: EntryStatus): EntryStatus {
  const index = CLICK_CYCLE.indexOf(current);
  if (index === -1) return "not_started";
  return CLICK_CYCLE[(index + 1) % CLICK_CYCLE.length];
}

export const STATUS_LABELS: Record<EntryStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Completed",
  failed: "Failed",
};

// Solid dot fill per status — the Simple grid's tick cells use these so the
// color vocabulary stays in one place.
export const STATUS_DOT_CLASS: Record<EntryStatus, string> = {
  not_started: "bg-muted-foreground/40",
  in_progress: "bg-warning-foreground",
  done: "bg-success-foreground",
  failed: "bg-destructive",
};

// Colored pill per status — the Detailed view's Status column (a value the
// eye needs to pick out of a whole row of plain text, unlike the Simple
// grid's already-colored dots) uses these.
export const STATUS_BADGE_CLASS: Record<EntryStatus, string> = {
  not_started: "bg-muted text-muted-foreground",
  in_progress: "bg-warning text-warning-foreground",
  done: "bg-success text-success-foreground",
  failed: "bg-destructive/15 text-destructive",
};

export const ALL_STATUSES: EntryStatus[] = ["not_started", "in_progress", "done", "failed"];
