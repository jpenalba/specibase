"use client";

import { REQUIRED_FIELDS, LOCATION_FIELDS, optionalFieldByKey } from "@/lib/fields";
import { RawRow } from "@/lib/validation";
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

export function StagingTable({
  staged,
  visibleOptionalKeys,
  onRemove,
}: {
  staged: StagedSample[];
  visibleOptionalKeys: string[];
  onRemove: (clientId: string) => void;
}) {
  const columns = [
    ...REQUIRED_FIELDS,
    ...LOCATION_FIELDS,
    ...visibleOptionalKeys
      .map((key) => optionalFieldByKey(key))
      .filter((f): f is NonNullable<typeof f> => Boolean(f)),
  ];

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
