"use client";

import { REQUIRED_FIELDS, LOCATION_FIELDS, optionalFieldByKey } from "@/lib/fields";
import { SampleRecord } from "@/lib/samples-store";
import { formatToDDMMYYYY } from "@/lib/dates";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

export function SampleTable({
  samples,
  visibleOptionalKeys,
}: {
  samples: SampleRecord[];
  visibleOptionalKeys: string[];
}) {
  const columns = [
    ...REQUIRED_FIELDS,
    ...LOCATION_FIELDS,
    ...visibleOptionalKeys
      .map((key) => optionalFieldByKey(key))
      .filter((f): f is NonNullable<typeof f> => Boolean(f)),
  ];

  if (samples.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        No samples yet. Add one, or import a CSV, to get started.
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
          </TableRow>
        </TableHeader>
        <TableBody>
          {samples.map((sample) => (
            <TableRow key={sample.id}>
              {columns.map((col) => {
                const value = sample[col.key];
                if (value === undefined || value === "") {
                  return (
                    <TableCell key={col.key}>
                      <span className="text-muted-foreground">—</span>
                    </TableCell>
                  );
                }
                return (
                  <TableCell key={col.key}>
                    {col.type === "date"
                      ? formatToDDMMYYYY(String(value))
                      : String(value)}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
