"use client";

import { useState } from "react";
import { SampleCustomColumn } from "@/lib/sample-custom-columns-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// "Other: specify" — lets someone define a brand-new, freely-named sample
// field right from the add/edit dialog, rather than being limited to the
// preset OPTIONAL_FIELDS vocabulary. The column is created immediately on
// "Add" (not deferred to the dialog's own submit) so it's available to fill
// in for this same sample right away — same immediate-create pattern as
// the lab/bio workflows' own ManageColumnsDialog.
export function AddOtherFieldControl({
  onAdded,
}: {
  onAdded: (column: SampleCustomColumn) => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setOpen(false);
    setLabel("");
    setError(null);
  }

  async function handleAdd() {
    if (!label.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/samples/custom-columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.errors?.join(" ") ?? "Couldn't add the field.");
        return;
      }
      onAdded(data.column);
      reset();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        Other: specify...
      </Button>
    );
  }

  return (
    <div className="col-span-2 grid gap-1.5 rounded-md border border-dashed border-input p-2">
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Input
          autoFocus
          placeholder="Field name (e.g. Tag color)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <Button type="button" size="sm" onClick={handleAdd} disabled={saving || !label.trim()}>
          Add
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={reset} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
