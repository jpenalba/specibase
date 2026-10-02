"use client";

import { useState } from "react";
import { OPTIONAL_FIELDS, REQUIRED_FIELDS } from "@/lib/fields";
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
  showRequiredFields = false,
  customColumns = [],
  hiddenCustomColumnIds,
  onToggleCustomColumn,
}: {
  selected: string[];
  onToggle: (key: string) => void;
  // Only TemplateDialog passes this — Sample ID and Species rendered as
  // permanently checked, disabled boxes ahead of the real (toggleable)
  // list, so it's visually obvious they're always in the download
  // regardless of anything ticked below. The table-columns picker
  // (FieldPickerButton) doesn't need this: those two columns are already
  // unconditionally pinned in the table itself, with nothing to toggle.
  showRequiredFields?: boolean;
  // "Other: specify" custom columns, shown as their own section below the
  // preset fields — only FieldPickerButton passes these (TemplateDialog's
  // CSV template is built from preset field keys alone, so it has nothing
  // to toggle here). Only {id, label} are read, so any custom-column shape
  // (sample, collection, ...) works.
  customColumns?: { id: string; label: string }[];
  hiddenCustomColumnIds?: Set<string>;
  onToggleCustomColumn?: (id: string) => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {showRequiredFields &&
          REQUIRED_FIELDS.map((field) => (
            <div key={field.key} className="flex items-start gap-2">
              <Checkbox id={`field-${field.key}`} checked disabled className="mt-0.5" />
              <div className="grid gap-0.5">
                <Label htmlFor={`field-${field.key}`} className="text-muted-foreground">
                  {field.label}
                </Label>
                <span className="text-xs text-muted-foreground">Always included — required</span>
              </div>
            </div>
          ))}
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
      {customColumns.length > 0 && onToggleCustomColumn && (
        <div className="grid gap-3 border-t border-border pt-3">
          <p className="text-xs font-medium text-muted-foreground">Custom columns</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {customColumns.map((column) => (
              <div key={column.id} className="flex items-start gap-2">
                <Checkbox
                  id={`custom-field-${column.id}`}
                  checked={!hiddenCustomColumnIds?.has(column.id)}
                  onCheckedChange={() => onToggleCustomColumn(column.id)}
                  className="mt-0.5"
                />
                <Label htmlFor={`custom-field-${column.id}`}>{column.label}</Label>
              </div>
            ))}
          </div>
        </div>
      )}
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
  customColumns = [],
  hiddenCustomColumnIds,
  onToggleCustomColumn,
}: {
  selected: string[];
  onToggle: (key: string) => void;
  // "Other: specify" custom columns, listed below the preset fields with
  // their own tick-to-hide checkboxes — see field-picker.tsx's own note on
  // FieldPicker for why only {id, label} are needed.
  customColumns?: { id: string; label: string }[];
  hiddenCustomColumnIds?: Set<string>;
  onToggleCustomColumn?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const visibleCustomCount = customColumns.filter((c) => !hiddenCustomColumnIds?.has(c.id)).length;
  const totalVisible = selected.length + visibleCustomCount;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Columns{totalVisible > 0 ? ` (${totalVisible})` : ""}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Table columns</DialogTitle>
          <DialogDescription>
            Tick which optional fields to show — the same set is used for the CSV template.
            Custom columns default to shown and can be hidden here without deleting them.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          <FieldPicker
            selected={selected}
            onToggle={onToggle}
            customColumns={customColumns}
            hiddenCustomColumnIds={hiddenCustomColumnIds}
            onToggleCustomColumn={onToggleCustomColumn}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
