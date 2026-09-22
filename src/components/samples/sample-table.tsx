"use client";

import { Fragment, useMemo, useState } from "react";
import { MoreHorizontal, Search, Trash2 } from "lucide-react";
import { getVisibleColumns, FieldDef } from "@/lib/fields";
import { DATE_FORMAT_LABEL, formatToDDMMYYYY } from "@/lib/dates";
import { RawRow } from "@/lib/validation";
import { SampleRecord, sampleToRawRow } from "@/lib/samples-store";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { SampleEditDialog } from "@/components/samples/sample-edit-dialog";
import { cn } from "@/lib/utils";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

type SortState = { key: string; direction: "asc" | "desc" };

const PAGE_SIZES = [20, 50, 100] as const;

function compareValues(a: unknown, b: unknown, type: FieldDef["type"]): number {
  const aEmpty = a === undefined || a === "" || a === null;
  const bEmpty = b === undefined || b === "" || b === null;
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1; // empty values always sort last, regardless of direction
  if (bEmpty) return -1;

  if (type === "number") return Number(a) - Number(b);
  // Dates are stored as ISO (YYYY-MM-DD), which sorts correctly as a plain
  // string — no need to special-case it separately from text.
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

async function deleteSampleRequest(id: string): Promise<{ ok: boolean; errors?: string[] }> {
  try {
    const res = await fetch(`/api/samples/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, errors: data.errors ?? ["Couldn't delete this sample."] };
    return { ok: true };
  } catch {
    return { ok: false, errors: ["Couldn't reach the server."] };
  }
}

export function SampleTable({
  samples,
  allIdentifiers,
  visibleOptionalKeys,
  hiddenSampleIds,
  onToggleHidden,
  highlightedSampleId,
  onSelectSample,
  editMode,
  onExitEditMode,
  onSampleUpdated,
  onSampleDeleted,
  extraRowAction,
}: {
  samples: SampleRecord[];
  // Every Sample ID currently in the database (not just this table's
  // possibly layer-filtered subset) — used to catch a duplicate Sample ID
  // before it round-trips to the server.
  allIdentifiers: string[];
  visibleOptionalKeys: string[];
  // Samples unticked here are excluded from the map — the tick box sits to
  // the left of every other column.
  hiddenSampleIds: Set<string>;
  onToggleHidden: (id: string) => void;
  // Clicking anywhere on a row except the tick box highlights that sample
  // on the map; clicking the already-highlighted row clears it.
  highlightedSampleId: string | null;
  onSelectSample: (id: string) => void;
  // Whole-table "spreadsheet" editing — every visible cell becomes
  // editable and each row gets a delete button. Toggled from the parent
  // so its own header row can host the Edit/Save/Cancel controls.
  editMode: boolean;
  onExitEditMode: () => void;
  onSampleUpdated: (sample: SampleRecord) => void;
  onSampleDeleted: (id: string) => void;
  // An extra per-row action shown in the actions menu (non-edit mode only)
  // above Delete — e.g. a project-scoped view offering "Remove from
  // project" alongside the sample's usual Edit/Delete.
  extraRowAction?: { label: string; onSelect: (sample: SampleRecord) => void };
}) {
  const columns = getVisibleColumns(visibleOptionalKeys);
  const [sort, setSort] = useState<SortState | null>(null);
  // Sample ID and species only for now — Genus/Family/Order will join
  // this once the schema has somewhere to put them.
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const [page, setPage] = useState(0);
  const [editingSample, setEditingSample] = useState<SampleRecord | null>(null);
  // Bumped every time the edit dialog is opened, forcing it to remount
  // (see its own comment) so reopening the same sample after a cancelled
  // edit always starts from that sample's real, current values.
  const [editDialogKey, setEditDialogKey] = useState(0);

  function openEditDialog(sample: SampleRecord) {
    setEditingSample(sample);
    setEditDialogKey((k) => k + 1);
  }
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  // Only rows the user has actually touched get an entry — everything else
  // still reads live from `samples`, so switching which optional columns
  // are visible mid-edit never clobbers an in-progress change.
  const [drafts, setDrafts] = useState<Record<string, RawRow>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  const filteredSamples = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return samples;
    return samples.filter(
      (s) =>
        s.primary_identifier.toLowerCase().includes(q) || s.species.toLowerCase().includes(q)
    );
  }, [samples, query]);

  const sortedSamples = useMemo(() => {
    if (!sort) return filteredSamples;
    const column = columns.find((c) => c.key === sort.key);
    if (!column) return filteredSamples;
    const sign = sort.direction === "asc" ? 1 : -1;
    return [...filteredSamples].sort(
      (a, b) => sign * compareValues(a[column.key], b[column.key], column.type)
    );
    // columns is derived fresh each render from visibleOptionalKeys, so it's
    // deliberately left out of the dependency list to avoid re-sorting on
    // every render — sort.key is enough to look the column back up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredSamples, sort]);

  // Derived fresh from `page` every render rather than synced back into
  // state — if the result set shrinks (a filter, a delete, a page-size
  // change) enough to push the stored page out of range, this just quietly
  // clamps for as long as it needs to, no effect required.
  const totalPages = Math.max(1, Math.ceil(sortedSamples.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pageSamples = sortedSamples.slice(
    currentPage * pageSize,
    currentPage * pageSize + pageSize
  );

  function toggleSort(key: string) {
    setSort((prev) => {
      if (prev?.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  }

  function updateDraftField(sample: SampleRecord, key: string, value: string) {
    setDrafts((prev) => {
      const base = prev[sample.id] ?? sampleToRawRow(sample, columns);
      return { ...prev, [sample.id]: { ...base, [key]: value } };
    });
  }

  async function saveAll() {
    const ids = Object.keys(drafts);
    if (ids.length === 0) {
      onExitEditMode();
      return;
    }
    setSaving(true);
    const nextErrors: Record<string, string[]> = {};
    const remainingDrafts: Record<string, RawRow> = {};
    for (const id of ids) {
      const res = await fetch(`/api/samples/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(drafts[id]),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        nextErrors[id] = data.errors ?? ["Couldn't save this row."];
        remainingDrafts[id] = drafts[id];
      } else {
        onSampleUpdated(data.sample);
      }
    }
    setDrafts(remainingDrafts);
    setRowErrors(nextErrors);
    setSaving(false);
    if (Object.keys(nextErrors).length === 0) {
      onExitEditMode();
    }
  }

  function cancelEdits() {
    setDrafts({});
    setRowErrors({});
    onExitEditMode();
  }

  async function handleDelete(sample: SampleRecord) {
    if (!window.confirm(`Delete sample "${sample.primary_identifier}"? This can't be undone.`)) {
      return;
    }
    setDeletingIds((prev) => new Set(prev).add(sample.id));
    const result = await deleteSampleRequest(sample.id);
    setDeletingIds((prev) => {
      const next = new Set(prev);
      next.delete(sample.id);
      return next;
    });
    if (!result.ok) {
      window.alert(result.errors?.join(" ") ?? "Couldn't delete this sample.");
      return;
    }
    onSampleDeleted(sample.id);
  }

  if (samples.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        No samples yet. Add one, or import a CSV, to get started.
      </div>
    );
  }

  const dirtyCount = Object.keys(drafts).length;
  const rangeStart = sortedSamples.length === 0 ? 0 : currentPage * pageSize + 1;
  const rangeEnd = Math.min(sortedSamples.length, currentPage * pageSize + pageSize);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search by Sample ID or species"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
        />
      </div>

      {editMode && (
        <div className="flex items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            Editing — click a cell to change it, or use the trash icon to delete a row.
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={cancelEdits}
              disabled={saving}
              className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveAll}
              disabled={saving || dirtyCount === 0}
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving..." : `Save changes${dirtyCount > 0 ? ` (${dirtyCount})` : ""}`}
            </button>
          </div>
        </div>
      )}

      {sortedSamples.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No samples match &quot;{query}&quot;.
        </div>
      ) : (
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-8 w-0">
                <span className="sr-only">Show on map</span>
              </TableHead>
              {columns.map((col) => (
                <TableHead key={col.key} className="h-8">
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    {col.label}
                    <span className="w-3 text-[10px]">
                      {sort?.key === col.key ? (sort.direction === "asc" ? "▲" : "▼") : ""}
                    </span>
                  </button>
                </TableHead>
              ))}
              <TableHead className="h-8 w-0">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageSamples.map((sample) => {
              const isHidden = hiddenSampleIds.has(sample.id);
              const isHighlighted = sample.id === highlightedSampleId;
              const draft = drafts[sample.id];
              const errors = rowErrors[sample.id];
              return (
                <Fragment key={sample.id}>
                  <TableRow
                    data-state={isHighlighted ? "selected" : undefined}
                    onClick={editMode ? undefined : () => onSelectSample(sample.id)}
                    className={cn(!editMode && "cursor-pointer")}
                  >
                    <TableCell className="py-1" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={!isHidden}
                        onCheckedChange={() => onToggleHidden(sample.id)}
                        aria-label={`Show ${sample.id} on the map`}
                      />
                    </TableCell>
                    {columns.map((col) => {
                      if (editMode) {
                        const value = draft
                          ? (draft[col.key] ?? "")
                          : (sampleToRawRow(sample, columns)[col.key] ?? "");
                        return (
                          <TableCell key={col.key} className="py-1" onClick={(e) => e.stopPropagation()}>
                            <Input
                              className="h-8 min-w-28"
                              placeholder={col.type === "date" ? DATE_FORMAT_LABEL : undefined}
                              value={value}
                              onChange={(e) => updateDraftField(sample, col.key, e.target.value)}
                            />
                          </TableCell>
                        );
                      }
                      const value = sample[col.key];
                      if (value === undefined || value === "") {
                        return (
                          <TableCell key={col.key} className={cn("py-1", isHidden && "opacity-50")}>
                            <span className="text-muted-foreground">—</span>
                          </TableCell>
                        );
                      }
                      return (
                        <TableCell key={col.key} className={cn("py-1", isHidden && "opacity-50")}>
                          {col.type === "date" ? formatToDDMMYYYY(String(value)) : String(value)}
                        </TableCell>
                      );
                    })}
                    <TableCell className="py-1" onClick={(e) => e.stopPropagation()}>
                      {editMode ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(sample)}
                          disabled={deletingIds.has(sample.id)}
                          aria-label={`Delete ${sample.primary_identifier}`}
                          className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label={`Actions for ${sample.primary_identifier}`}
                              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            >
                              <MoreHorizontal className="size-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => openEditDialog(sample)}>
                              Edit
                            </DropdownMenuItem>
                            {extraRowAction && (
                              <DropdownMenuItem onSelect={() => extraRowAction.onSelect(sample)}>
                                {extraRowAction.label}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => handleDelete(sample)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                  {editMode && errors && errors.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={columns.length + 2} className="py-1.5 text-xs text-destructive">
                        {errors.join(" ")}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span>Rows per page</span>
          <select
            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(0);
            }}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3 text-muted-foreground">
          <span>
            {sortedSamples.length === 0
              ? "0 of 0"
              : `${rangeStart}–${rangeEnd} of ${sortedSamples.length}`}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="rounded-md border border-input px-3 py-1 hover:bg-accent disabled:opacity-50 disabled:hover:bg-transparent"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={currentPage >= totalPages - 1}
              className="rounded-md border border-input px-3 py-1 hover:bg-accent disabled:opacity-50 disabled:hover:bg-transparent"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <SampleEditDialog
        key={editDialogKey}
        sample={editingSample}
        otherIdentifiers={allIdentifiers.filter((id) => id !== editingSample?.primary_identifier)}
        onClose={() => setEditingSample(null)}
        onSaved={onSampleUpdated}
      />
    </div>
  );
}
