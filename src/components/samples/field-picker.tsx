"use client";

import { useState } from "react";
import { OPTIONAL_FIELDS } from "@/lib/fields";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";

// Bare checkbox grid — used directly inside TemplateDialog, which is
// already its own modal, so the grid doesn't need collapsing again there.
// Everywhere else, use FieldPickerButton below instead.
export function FieldPicker({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (key: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
      {OPTIONAL_FIELDS.map((field) => (
        <div key={field.key} className="flex items-start gap-2">
          <Checkbox
            id={`field-${field.key}`}
            checked={selected.includes(field.key)}
            onCheckedChange={() => onToggle(field.key)}
            className="mt-0.5"
          />
          <div className="grid gap-0.5">
            <Label htmlFor={`field-${field.key}`}>{field.label}</Label>
            {field.description && (
              <span className="text-xs text-muted-foreground">
                {field.description}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Collapses the field picker behind a small button — with as many optional
// fields as the app now has, always showing the full checklist inline (the
// Database page, a project's Samples tab, the Add samples panel) ate too
// much vertical space. Opens a dialog on demand instead.
export function FieldPickerButton({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Columns{selected.length > 0 ? ` (${selected.length})` : ""}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Table columns</DialogTitle>
          <DialogDescription>
            Tick which optional fields to show — the same set is used for the CSV template.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          <FieldPicker selected={selected} onToggle={onToggle} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
