import { FieldDef } from "./fields";
import { formatToDDMMYYYY } from "./dates";
import { SampleRecord } from "./samples-store";

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// Exports every field, not just the ones currently ticked visible in the
// table — a "download my data" action should give you everything, not
// whatever subset a display toggle happened to be set to.
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
