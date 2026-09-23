"use client";

import { ChevronDown, RotateCcw } from "lucide-react";
import { MARKER_STYLE_FIELDS, markerStyleFieldByKey } from "@/lib/fields";
import { LayerShape } from "@/lib/layer-shapes";
import { CategoryStyle } from "@/lib/marker-style";
import { StylePicker } from "@/components/database/style-picker";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

const SINGLE_COLOR_LABEL = "Single color";

// Sits above a project's Samples-tab map — lets someone pick either one
// flat color/shape for every sample, or a field (species, country, ...) to
// color/shape samples by, with a per-value swatch/shape picker once a
// field's chosen. Purely controlled: every change is reported upward and
// persisted by the page, not held as local state here.
export function MarkerStylePanel({
  fieldKey,
  onFieldChange,
  singleColor,
  singleShape,
  onSingleStyleChange,
  categories,
  onCategoryStyleChange,
  onCategoryStyleReset,
}: {
  fieldKey: string | null;
  onFieldChange: (key: string | null) => void;
  singleColor: string;
  singleShape: LayerShape;
  onSingleStyleChange: (color: string, shape: LayerShape) => void;
  categories: CategoryStyle[];
  onCategoryStyleChange: (value: string, color: string, shape: LayerShape) => void;
  onCategoryStyleReset: (value: string) => void;
}) {
  const activeField = fieldKey ? markerStyleFieldByKey(fieldKey) : undefined;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Marker style</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              {activeField ? `By ${activeField.label}` : SINGLE_COLOR_LABEL}
              <ChevronDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => onFieldChange(null)}>
              {SINGLE_COLOR_LABEL}
            </DropdownMenuItem>
            {MARKER_STYLE_FIELDS.map((field) => (
              <DropdownMenuItem key={field.key} onSelect={() => onFieldChange(field.key)}>
                By {field.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {!activeField && (
          <StylePicker
            color={singleColor}
            shape={singleShape}
            label="This project's samples"
            onSetColor={(color) => onSingleStyleChange(color, singleShape)}
            onSetShape={(shape) => onSingleStyleChange(singleColor, shape)}
          />
        )}
      </div>

      {activeField &&
        (categories.length === 0 ? (
          <p className="text-xs text-muted-foreground">No samples yet to show categories for.</p>
        ) : (
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat) => (
              <div
                key={cat.value}
                className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent/50"
              >
                <StylePicker
                  color={cat.color}
                  shape={cat.shape}
                  label={cat.label}
                  onSetColor={(color) => onCategoryStyleChange(cat.value, color, cat.shape)}
                  onSetShape={(shape) => onCategoryStyleChange(cat.value, cat.color, shape)}
                />
                <span className="flex-1 truncate" title={cat.label}>
                  {cat.label}
                </span>
                <span className="text-xs text-muted-foreground">{cat.count}</span>
                {cat.isOverridden && (
                  <button
                    type="button"
                    onClick={() => onCategoryStyleReset(cat.value)}
                    className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    aria-label={`Reset ${cat.label} to its automatic color`}
                    title="Reset to automatic color"
                  >
                    <RotateCcw className="size-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}
