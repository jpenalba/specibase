"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ActivityLogEntry } from "@/lib/activity-log";
import { useProjectRole } from "@/lib/project-role-context";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Same day-grouping presentation as the global /logs page, scoped to just
// this project's tagged entries (see activity_log.project_id). Only
// actions clearly scoped to one project show up here — a sample edited
// from the shared Database, say, still only appears in the global log.
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

export default function ProjectLogsPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const role = useProjectRole();
  const isOwner = role === "owner";

  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingToggle, setSavingToggle] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/projects/${projectId}/activity-log`)
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
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleEnabled() {
    const next = !enabled;
    setEnabled(next);
    setSavingToggle(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/activity-log`, {
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Logs</h1>
          <p className="text-sm text-muted-foreground">
            A running record of changes made within this project, visible to every member. See
            your own{" "}
            <a href="/logs" className="underline">
              Logs
            </a>{" "}
            page for everything else you&apos;ve done, including sample and collection edits made
            from the shared Database.
          </p>
        </div>
        {isOwner && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="project-logging-enabled"
              checked={enabled}
              onCheckedChange={toggleEnabled}
              disabled={savingToggle}
            />
            <Label htmlFor="project-logging-enabled">Keep this project&apos;s log</Label>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Couldn&apos;t load logs: {error}. If you haven&apos;t already, run{" "}
          <code className="rounded bg-black/10 px-1">
            supabase/migrations/0030_protocol_projects_and_project_logs.sql
          </code>{" "}
          in the Supabase SQL Editor.
        </div>
      )}

      {!enabled && !error && (
        <div className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
          This project&apos;s log is turned off — new changes won&apos;t show up here
          {isOwner ? " until you turn it back on above" : " until an Owner turns it back on"}. Each
          member&apos;s own actions are still recorded on their personal Logs page either way.
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nothing logged for this project yet.
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
                      {entry.performed_by && (
                        <span className="font-medium">{entry.performed_by}: </span>
                      )}
                      {entry.summary}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {timeOfDay(entry.created_at)}
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
