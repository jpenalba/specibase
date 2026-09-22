import { NextRequest, NextResponse } from "next/server";
import { EntryUpsertInput, upsertEntries } from "@/lib/lab-workflows-store";
import { ALL_STATUSES } from "@/lib/lab-workflow-status";
import { apiError } from "@/lib/api-error";

function parseEntries(body: unknown): EntryUpsertInput[] | { error: string } {
  if (!Array.isArray(body) || body.length === 0) {
    return { error: "At least one entry is required" };
  }
  const entries: EntryUpsertInput[] = [];
  for (const raw of body) {
    if (!raw || typeof raw !== "object") return { error: "Invalid entry" };
    const row = raw as Record<string, unknown>;
    if (typeof row.step_id !== "string" || typeof row.sample_id !== "string") {
      return { error: "Every entry needs step_id and sample_id" };
    }
    const entry: EntryUpsertInput = { step_id: row.step_id, sample_id: row.sample_id };

    if ("status" in row) {
      if (typeof row.status !== "string" || !ALL_STATUSES.includes(row.status as never)) {
        return { error: `Unknown status "${row.status}"` };
      }
      entry.status = row.status as EntryUpsertInput["status"];
    }
    if ("method" in row) entry.method = typeof row.method === "string" ? row.method.trim() || null : null;
    if ("date" in row) entry.date = typeof row.date === "string" ? row.date || null : null;
    if ("performed_by" in row) {
      entry.performed_by = typeof row.performed_by === "string" ? row.performed_by.trim() || null : null;
    }
    if ("notes" in row) entry.notes = typeof row.notes === "string" ? row.notes.trim() || null : null;
    if ("quantification" in row) {
      entry.quantification =
        row.quantification && typeof row.quantification === "object"
          ? (row.quantification as Record<string, unknown>)
          : null;
    }

    entries.push(entry);
  }
  return entries;
}

// Bulk upsert — used both by the Simple grid's drag-paint (one PATCH per
// drag, status only) and the Detailed view's per-cell edits (may include
// method/date/performed_by/quantification/notes alongside status).
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const entries = parseEntries(body?.entries);
    if ("error" in entries) {
      return NextResponse.json({ errors: [entries.error] }, { status: 400 });
    }
    const result = await upsertEntries(entries);
    return NextResponse.json({ entries: result });
  } catch (error) {
    return apiError(error);
  }
}
