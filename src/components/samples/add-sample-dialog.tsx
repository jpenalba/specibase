"use client";

import { useState } from "react";
import {
  REQUIRED_FIELDS,
  LOCATION_FIELDS,
  optionalFieldByKey,
} from "@/lib/fields";
import { DATE_FORMAT_LABEL } from "@/lib/dates";
import { RawRow, validateRow } from "@/lib/validation";
import { GbifClassification } from "@/lib/gbif";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SpeciesInput } from "./species-input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AddSampleDialog({
  visibleOptionalKeys,
  takenIdentifiers,
  onStage,
}: {
  visibleOptionalKeys: string[];
  takenIdentifiers: string[];
  onStage: (row: RawRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<RawRow>({});
  const [errors, setErrors] = useState<string[]>([]);

  const optionalFields = visibleOptionalKeys
    .map((key) => optionalFieldByKey(key))
    .filter((f): f is NonNullable<typeof f> => Boolean(f));

  function update(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  // Only fills columns GBIF actually returned, and never overwrites a
  // value the person already typed by hand for this species.
  function applyGbifMatch(match: GbifClassification | null) {
    setValues((prev) => ({
      ...prev,
      genus: prev.genus || match?.genus || prev.genus,
      family: prev.family || match?.family || prev.family,
      taxon_order: prev.taxon_order || match?.order || prev.taxon_order,
      taxon_class: prev.taxon_class || match?.class || prev.taxon_class,
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { errors: rowErrors } = validateRow(values, new Set(takenIdentifiers));
    if (rowErrors.length > 0) {
      setErrors(rowErrors);
      return;
    }
    onStage(values);
    setValues({});
    setErrors([]);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add sample</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add sample</DialogTitle>
          <DialogDescription>
            This stages the sample below — it isn&apos;t saved to the
            database until you upload the staged batch.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          {errors.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <ul className="list-disc pl-4">
                {errors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {REQUIRED_FIELDS.map((field) => (
              <div key={field.key} className="grid gap-1.5">
                <Label htmlFor={field.key}>{field.label} *</Label>
                {field.key === "species" ? (
                  <SpeciesInput
                    id={field.key}
                    value={values[field.key] ?? ""}
                    onChange={(value) => update(field.key, value)}
                    onResolved={applyGbifMatch}
                  />
                ) : (
                  <Input
                    id={field.key}
                    value={values[field.key] ?? ""}
                    onChange={(e) => update(field.key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="grid gap-3 rounded-md border border-border p-3">
            <p className="text-xs text-muted-foreground">
              Provide either latitude &amp; longitude, or a locality.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {LOCATION_FIELDS.map((field) => (
                <div key={field.key} className="grid gap-1.5">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <Input
                    id={field.key}
                    value={values[field.key] ?? ""}
                    onChange={(e) => update(field.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          {optionalFields.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {optionalFields.map((field) => (
                <div key={field.key} className="grid gap-1.5">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  {field.type === "select" ? (
                    <select
                      id={field.key}
                      value={values[field.key] ?? ""}
                      onChange={(e) => update(field.key, e.target.value)}
                      className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">—</option>
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id={field.key}
                      placeholder={field.type === "date" ? DATE_FORMAT_LABEL : undefined}
                      value={values[field.key] ?? ""}
                      onChange={(e) => update(field.key, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button type="submit">Stage sample</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
