import { FieldDef } from "./fields";
import { formatToDDMMYYYY } from "./dates";
import { formatDateDisplay } from "./date-format";
import { EntryStatus, STATUS_LABELS } from "./lab-workflow-status";
import { SampleRecord } from "./samples-store";

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// `columns` is caller-supplied rather than hardcoded to ALL_FIELDS so the
// export can mirror whatever's currently ticked visible in the table.
export function samplesToCsv(samples: SampleRecord[], columns: FieldDef[]): string {
  const header = columns.map((c) => csvEscape(c.label)).join(",");
  const rows = samples.map((sample) =>
    columns
      .map((col) => {
        const raw = sample[col.key];
        if (raw === undefined || raw === null || raw === "") return "";
        const display = col.type === "date" ? formatToDDMMYYYY(String(raw)) : String(raw);
        return csvEscape(display);
      })
      .join(",")
  );
  return [header, ...rows].join("\n");
}

// Head/body ready for jspdf-autotable — same column set/formatting as
// samplesToCsv, for the whole-project PDF export's Samples section.
export function samplesToAutoTableRows(
  samples: SampleRecord[],
  columns: FieldDef[]
): { head: string[][]; body: string[][] } {
  const head = [columns.map((c) => c.label)];
  const body = samples.map((sample) =>
    columns.map((col) => {
      const raw = sample[col.key];
      if (raw === undefined || raw === null || raw === "") return "";
      return col.type === "date" ? formatToDDMMYYYY(String(raw)) : String(raw);
    })
  );
  return { head, body };
}

// Structurally typed (not imported from lab-workflows-store) since
// bio-workflows-store's DetailColumn/Row/Value types have the identical
// shape and this needs to work for both without favoring either one.
type DetailColumnLike = { id: string; label: string; kind: "text" | "date" | "status" };
type DetailRowLike = { id: string; sample_id: string; attempt_number: number };
type DetailValueLike = { column_id: string; row_id: string; value: string | null };

// One entry per (sample, attempt) pair — a redone sample gets a second
// entry, same grouping/ordering as DetailTable's own displayRows — with
// each detail column's value formatted the same way DetailTable's view
// mode shows it (status as its label, date as dd Mon yyyy). Shared by the
// CSV and PDF-table exporters below so the row set/order/formatting can't
// drift apart between them.
function buildDetailTableRows(
  samples: SampleRecord[],
  rows: DetailRowLike[],
  columns: DetailColumnLike[],
  values: DetailValueLike[]
): { idLabel: string; cells: string[] }[] {
  const rowsBySample = new Map<string, DetailRowLike[]>();
  for (const row of rows) {
    const list = rowsBySample.get(row.sample_id) ?? [];
    list.push(row);
    rowsBySample.set(row.sample_id, list);
  }
  for (const list of rowsBySample.values()) list.sort((a, b) => a.attempt_number - b.attempt_number);

  const valueByCell = new Map<string, string>();
  for (const v of values) valueByCell.set(`${v.column_id}:${v.row_id}`, v.value ?? "");

  const result: { idLabel: string; cells: string[] }[] = [];
  for (const sample of samples) {
    for (const row of rowsBySample.get(sample.id) ?? []) {
      const idLabel =
        row.attempt_number > 1
          ? `${sample.primary_identifier} (redo ${row.attempt_number})`
          : sample.primary_identifier;
      const cells = columns.map((col) => {
        const raw = valueByCell.get(`${col.id}:${row.id}`) ?? "";
        if (!raw) return "";
        if (col.kind === "date") return formatDateDisplay(raw);
        if (col.kind === "status") return STATUS_LABELS[raw as EntryStatus] ?? raw;
        return raw;
      });
      result.push({ idLabel, cells });
    }
  }
  return result;
}

export function detailTableToCsv(
  samples: SampleRecord[],
  rows: DetailRowLike[],
  columns: DetailColumnLike[],
  values: DetailValueLike[]
): string {
  const header = ["Sample ID", ...columns.map((c) => c.label)].map(csvEscape).join(",");
  const lines = buildDetailTableRows(samples, rows, columns, values).map((r) =>
    [csvEscape(r.idLabel), ...r.cells.map(csvEscape)].join(",")
  );
  return [header, ...lines].join("\n");
}

// Head/body ready for jspdf-autotable — used by the whole-project PDF
// export to lay out a workflow's full Detailed view as a real table.
export function detailTableToAutoTableRows(
  samples: SampleRecord[],
  rows: DetailRowLike[],
  columns: DetailColumnLike[],
  values: DetailValueLike[]
): { head: string[][]; body: string[][] } {
  const head = [["Sample ID", ...columns.map((c) => c.label)]];
  const body = buildDetailTableRows(samples, rows, columns, values).map((r) => [r.idLabel, ...r.cells]);
  return { head, body };
}

export function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
