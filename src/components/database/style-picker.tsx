"use client";

import { useState } from "react";
import { LayerShape, LAYER_SHAPES } from "@/lib/layer-shapes";
import { PICKABLE_LAYER_COLORS } from "@/lib/layer-colors";
import { LayerShapeIcon } from "./layer-shape-icon";
import { cn } from "@/lib/utils";

// A small popover for picking a color+shape pair — shared by the map
// layer panel (one pick per layer) and a project's Samples-tab marker
// styling (one pick per layer, or per category value when coloring by a
// field). Deliberately just {color, shape} in and callbacks out, no
// knowledge of what it's styling.
export function StylePicker({
  color,
  shape,
  label,
  onSetColor,
  onSetShape,
}: {
  color: string;
  shape: LayerShape;
  // Used in the trigger button's accessible name/title, e.g. "This
  // project" or a category value like "Homo sapiens".
  label: string;
  onSetColor: (color: string) => void;
  onSetShape: (shape: LayerShape) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-accent"
        title={`Change ${label}'s map color and shape`}
        aria-label={`Change ${label}'s map color and shape`}
      >
        <LayerShapeIcon shape={shape} color={color} />
      </button>

      {open && (
        <>
          {/* Click-outside backdrop — simpler than wiring a document
              listener for what's meant to be a small, basic picker. */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 z-20 mt-1 w-40 rounded-md border border-border bg-card p-2 shadow-md">
            <p className="mb-1 text-[10px] font-medium text-muted-foreground">Color</p>
            <div className="mb-2 flex flex-wrap gap-1">
              {PICKABLE_LAYER_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onSetColor(c)}
                  className={cn(
                    "size-5 rounded-full border",
                    c === color ? "border-foreground" : "border-transparent"
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Set color to ${c}`}
                  title={c}
                />
              ))}
            </div>
            <p className="mb-1 text-[10px] font-medium text-muted-foreground">Shape</p>
            <div className="flex gap-1">
              {LAYER_SHAPES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSetShape(s)}
                  className={cn(
                    "flex size-6 items-center justify-center rounded border",
                    s === shape ? "border-foreground bg-accent" : "border-transparent hover:bg-accent"
                  )}
                  aria-label={`Set shape to ${s}`}
                  title={s}
                >
                  <LayerShapeIcon shape={s} color={color} size={16} />
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
