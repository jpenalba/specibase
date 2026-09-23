"use client";

import { useState } from "react";
import { REQUIRED_FIELDS, LOCATION_FIELDS, OPTIONAL_FIELDS, ALL_FIELDS } from "@/lib/fields";
import { DATE_FORMAT_LABEL } from "@/lib/dates";
import { RawRow, validateRow } from "@/lib/validation";
import { SampleRecord, sampleToRawRow } from "@/lib/samples-store";
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
} from "@/components/ui/dialog";

// Edits every field, not just whatever's currently visible in the table —
// this is a deliberate, focused action on one sample, so there's no reason
// to hide fields the way the table's column picker does.
export function SampleEditDialog({
  sample,
  otherIdentifiers,
  onClose,
  onSaved,
}: {
  // null closes the dialog — controlled entirely by whether a sample is
  // being edited, rather than a separate open flag that could drift.
  sample: SampleRecord | null;
  // Every other sample's Sample ID, so this one's own current ID isn't
  // flagged as colliding with itself.
  otherIdentifiers: string[];
  onClose: () => void;
  onSaved: (sample: SampleRecord) => void;
}) {
  // The parent remounts this component (via a changing `key`) every time a
  // new edit is opened, so a lazy initializer is enough to seed the form —
  // no effect needed to resync `values` when `sample` changes.
  const [values, setValues] = useState<RawRow>(() =>
    sample ? sampleToRawRow(sample, ALL_FIELDS) : {}
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function update(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  // Only fills columns GBIF actually returned, and never overwrites a
  // value already sitting in the field (typed, or from the sample as-saved).
  function applyGbifMatch(match: GbifClassification | null) {
    setValues((prev) => ({
      ...prev,
      genus: prev.genus || match?.genus || prev.genus,
      family: prev.family || match?.family || prev.family,
      taxon_order: prev.taxon_order || match?.order || prev.taxon_order,
      taxon_class: prev.taxon_class || match?.class || prev.taxon_class,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sample) return;

    const { errors: rowErrors } = validateRow(values, new Set(otherIdentifiers));
    if (rowErrors.length > 0) {
      setErrors(rowErrors);
      return;
    }

    setSubmitting(true);
    setErrors([]);
    try {
      const res = await fetch(`/api/samples/${sample.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.errors ?? ["Couldn't save the sample."]);
        return;
      }
      onSaved(data.sample);
      onClose();
    } catch {
      setErrors(["Couldn't reach the server."]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={sample !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit sample</DialogTitle>
          <DialogDescription>Changes save directly to the database.</DialogDescription>
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
                <Label htmlFor={`edit-${field.key}`}>{field.label} *</Label>
                {field.key === "primary_identifier" ? (
                  <>
                    <div
                      id={`edit-${field.key}`}
                      className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground"
                    >
                      {values[field.key]}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Can&apos;t be changed — delete the sample to remove it.
                    </p>
                  </>
                ) : field.key === "species" ? (
                  <SpeciesInput
                    id={`edit-${field.key}`}
                    value={values[field.key] ?? ""}
                    onChange={(value) => update(field.key, value)}
                    onResolved={applyGbifMatch}
                  />
                ) : (
                  <Input
                    id={`edit-${field.key}`}
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
                  <Label htmlFor={`edit-${field.key}`}>{field.label}</Label>
                  <Input
                    id={`edit-${field.key}`}
                    value={values[field.key] ?? ""}
                    onChange={(e) => update(field.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {OPTIONAL_FIELDS.map((field) => (
              <div key={field.key} className="grid gap-1.5">
                <Label htmlFor={`edit-${field.key}`}>{field.label}</Label>
                {field.type === "select" ? (
                  <select
                    id={`edit-${field.key}`}
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
                    id={`edit-${field.key}`}
                    placeholder={field.type === "date" ? DATE_FORMAT_LABEL : undefined}
                    value={values[field.key] ?? ""}
                    onChange={(e) => update(field.key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
