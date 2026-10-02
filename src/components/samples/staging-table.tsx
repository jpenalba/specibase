"use client";

import { REQUIRED_FIELDS, OPTIONAL_FIELDS, FieldDef } from "@/lib/fields";
import { RawRow } from "@/lib/validation";
import {
  SampleCustomColumn,
  customColumnKey,
  customColumnToFieldDef,
} from "@/lib/sample-custom-columns-store";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

export type StagedSample = { clientId: string; row: RawRow };

// The columns to show are whatever's actually present across the staged
// rows — not the app's persisted "Columns" picker setting. A downloaded
// template column that got deleted before upload shouldn't show up just
// because it's ticked elsewhere, and a CSV's own unrecognized column
// should show up even though nothing was ever ticked for it. Order: the
// two required fields first, then known fields in their usual order, then
// custom columns, then (shouldn't normally happen — see ImportDialog's own
// handling of unrecognized headers) anything left over under its raw key.
function stagedColumns(staged: StagedSample[], customColumns: SampleCustomColumn[]): FieldDef[] {
  const presentKeys = new Set<string>();
  for (const { row } of staged) {
    for (const key of Object.keys(row)) presentKeys.add(key);
  }
  presentKeys.delete("primary_identifier");
  presentKeys.delete("species");

  const columns: FieldDef[] = [...REQUIRED_FIELDS];

  for (const field of OPTIONAL_FIELDS) {
    if (presentKeys.delete(field.key)) columns.push(field);
  }
  for (const column of customColumns) {
    if (presentKeys.delete(customColumnKey(column.id))) columns.push(customColumnToFieldDef(column));
  }
  for (const key of presentKeys) {
    columns.push({ key, label: key, type: "text" });
  }

  return columns;
}

export function StagingTable({
  staged,
  customColumns = [],
  onRemove,
}: {
  staged: StagedSample[];
  customColumns?: SampleCustomColumn[];
  onRemove: (clientId: string) => void;
}) {
  const columns = stagedColumns(staged, customColumns);

  if (staged.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        Nothing staged yet. Use Add sample or Import CSV to stage samples,
        then upload the batch below.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key}>{col.label}</TableHead>
            ))}
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {staged.map(({ clientId, row }) => (
            <TableRow key={clientId}>
              {columns.map((col) => (
                <TableCell key={col.key}>
                  {row[col.key] ? (
                    row[col.key]
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              ))}
              <TableCell>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(clientId)}
                >
                  Remove
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
