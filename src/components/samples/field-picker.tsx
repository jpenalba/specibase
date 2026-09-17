"use client";

import { OPTIONAL_FIELDS } from "@/lib/fields";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

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
