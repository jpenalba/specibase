"use client";

import { useCallback, useEffect, useState } from "react";
import { ActivityLogEntry } from "@/lib/activity-log";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Groups entries by local calendar day — "23 September 2026" — so a long
// history reads as a scannable list of days rather than one flat feed.
function dayHeading(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}

function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LogsPage() {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingToggle, setSavingToggle] = useState(false);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [undoError, setUndoError] = useState<string | null>(null);

  // Not called with loading reset to true on every refetch (e.g. after an
  // undo) — only the very first load, which `loading`'s initial state
  // already covers, needs the "Loading..." placeholder.
  const load = useCallback(() => {
    fetch("/api/activity-log")
      .then((res) => res.json())
      .then((data) => {
        if (data.errors?.length > 0) {
          setError(data.errors.join(" "));
        } else {
          setError(null);
          setEntries(data.entries ?? []);
          setEnabled(data.enabled ?? true);
        }
      })
      .catch(() => setError("Couldn't reach the server."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleEnabled() {
    const next = !enabled;
    setEnabled(next);
    setSavingToggle(true);
    try {
      const res = await fetch("/api/activity-log/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) setEnabled(!next);
    } catch {
      setEnabled(!next);
    } finally {
      setSavingToggle(false);
    }
  }

  async function undo(entry: ActivityLogEntry) {
    setUndoingId(entry.id);
    setUndoError(null);
    try {
      const res = await fetch(`/api/activity-log/${entry.id}/undo`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setUndoError(data.errors?.join(" ") ?? "Couldn't undo this.");
        return;
      }
      load();
    } catch {
      setUndoError("Couldn't reach the server.");
    } finally {
      setUndoingId(null);
    }
  }

  const groups: { key: string; heading: string; entries: ActivityLogEntry[] }[] = [];
  for (const entry of entries) {
    const key = dayKey(entry.created_at);
    const last = groups[groups.length - 1];
    if (last?.key === key) {
      last.entries.push(entry);
    } else {
      groups.push({ key, heading: dayHeading(entry.created_at), entries: [entry] });
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6 sm:p-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Logs</h1>
          <p className="text-sm text-muted-foreground">
            A running record of changes made in Specibase — samples added or edited, projects
            created, and so on. Recent deletes and imports can be undone below.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="logging-enabled"
            checked={enabled}
            onCheckedChange={toggleEnabled}
            disabled={savingToggle}
          />
          <Label htmlFor="logging-enabled">Log changes</Label>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Couldn&apos;t load logs: {error}. If you haven&apos;t already, run{" "}
          <code className="rounded bg-black/10 px-1">supabase/migrations/0024_activity_log.sql</code>{" "}
          and{" "}
          <code className="rounded bg-black/10 px-1">supabase/migrations/0025_undo.sql</code> in the
          Supabase SQL Editor.
        </div>
      )}

      {undoError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {undoError}
        </div>
      )}

      {!enabled && !error && (
        <div className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
          Logging is turned off — new changes won&apos;t be recorded until you turn it back on.
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nothing logged yet.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((group) => (
            <div key={group.key} className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">{group.heading}</h2>
              <div className="rounded-lg border border-border">
                {group.entries.map((entry, i) => (
                  <div
                    key={entry.id}
                    className={cn(
                      "flex items-center justify-between gap-4 p-3 text-sm",
                      i > 0 && "border-t border-border"
                    )}
                  >
                    <span className={cn(entry.undone_at && "text-muted-foreground line-through")}>
                      {entry.summary}
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      {entry.undone_at ? (
                        <span className="text-xs text-muted-foreground">Undone</span>
                      ) : (
                        entry.undo_data && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            disabled={undoingId === entry.id}
                            onClick={() => undo(entry)}
                          >
                            {undoingId === entry.id ? "Undoing..." : "Undo"}
                          </Button>
                        )
                      )}
                      <span className="font-mono text-xs text-muted-foreground">
                        {timeOfDay(entry.created_at)}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
