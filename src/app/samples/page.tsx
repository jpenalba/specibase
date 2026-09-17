"use client";

import { useCallback, useEffect, useState } from "react";
import { SampleRecord } from "@/lib/samples-store";
import { useOptionalFields } from "@/lib/use-optional-fields";
import { SampleTable } from "@/components/samples/sample-table";
import { AddSampleDialog } from "@/components/samples/add-sample-dialog";
import { TemplateDialog } from "@/components/samples/template-dialog";
import { ImportDialog } from "@/components/samples/import-dialog";
import { FieldPicker } from "@/components/samples/field-picker";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

export default function SamplesPage() {
  const [samples, setSamples] = useState<SampleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { selected, toggle } = useOptionalFields();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/samples");
      const data = await res.json();
      setSamples(data.samples ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // One-shot fetch on mount, not a state-sync loop — refresh() is also
    // called explicitly after mutations (add/import), so this only runs once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6 sm:p-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Samples</h1>
          <p className="text-sm text-muted-foreground">
            {samples.length} sample{samples.length === 1 ? "" : "s"} recorded
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ImportDialog
            existingIdentifiers={samples.map((s) => s.primary_identifier)}
            onImported={refresh}
          />
          <TemplateDialog selected={selected} onToggle={toggle} />
          <AddSampleDialog visibleOptionalKeys={selected} onCreated={refresh} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Table columns</CardTitle>
          <CardDescription>
            Tick which optional fields to show here — the same set is used
            for the CSV template.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldPicker selected={selected} onToggle={toggle} />
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <SampleTable samples={samples} visibleOptionalKeys={selected} />
      )}
    </div>
  );
}
