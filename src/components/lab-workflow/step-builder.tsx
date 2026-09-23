"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { STEP_PRESETS } from "@/lib/lab-workflow-steps";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

// Every step-preset vocabulary (Lab Workflow's STEP_PRESETS, Bioinformatic
// Workflow's BIO_STEP_PRESETS) uses this literal as its "type your own
// label" sentinel, so it's hardcoded here rather than imported from either
// domain's preset file — this component doesn't otherwise know which
// domain it's building steps for.
const CUSTOM_KEY = "custom";
type StepPresetLike = { key: string; label: string };

// clientId is a purely local React key (stable across reorders even
// though array index isn't) — `id` only exists once a step has actually
// been persisted, which StepManagerDialog uses to diff against the server.
export type BuilderStep = { clientId: string; id?: string; step_key: string; label: string };

function newClientId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

export function newBuilderStep(step_key: string, label: string): BuilderStep {
  return { clientId: newClientId(), step_key, label };
}

// Pick-from-presets-or-add-custom step editor, shared by the create-workflow
// dialog (local-only state) and StepManagerDialog (diffed against the
// server on save) — this component only ever edits the array it's given.
export function StepBuilder({
  steps,
  onChange,
  onBeforeRemove,
  presets: presetsProp = STEP_PRESETS,
}: {
  steps: BuilderStep[];
  onChange: (steps: BuilderStep[]) => void;
  // Lets a caller (StepManagerDialog) veto removing a step that already
  // has sample data logged against it, e.g. via a confirmation prompt.
  // Returning false leaves the step list untouched.
  onBeforeRemove?: (step: BuilderStep) => boolean;
  // The pick-a-preset pills — defaults to Lab Workflow's vocabulary so
  // existing callers don't need to change; Bioinformatic Workflow passes
  // its own (BIO_STEP_PRESETS).
  presets?: StepPresetLike[];
}) {
  const [customLabel, setCustomLabel] = useState("");
  const presets = presetsProp.filter((p) => p.key !== CUSTOM_KEY);

  function add(step_key: string, label: string) {
    onChange([...steps, newBuilderStep(step_key, label)]);
  }

  function addCustom() {
    const label = customLabel.trim();
    if (!label) return;
    add(CUSTOM_KEY, label);
    setCustomLabel("");
  }

  function remove(index: number) {
    if (onBeforeRemove && !onBeforeRemove(steps[index])) return;
    onChange(steps.filter((_, i) => i !== index));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function rename(index: number, label: string) {
    const next = [...steps];
    next[index] = { ...next[index], label };
    onChange(next);
  }

  return (
    <div className="grid gap-2">
      <Label>Steps *</Label>
      {steps.length === 0 ? (
        <p className="text-sm text-muted-foreground">No steps yet — add some below.</p>
      ) : (
        <ol className="grid gap-1.5">
          {steps.map((step, index) => (
            <li
              key={step.clientId}
              className="flex items-center gap-2 rounded-md border border-input px-2 py-1.5"
            >
              <span className="w-5 text-center text-xs text-muted-foreground">{index + 1}</span>
              {step.step_key === CUSTOM_KEY ? (
                <Input
                  value={step.label}
                  onChange={(e) => rename(index, e.target.value)}
                  className="h-7 flex-1"
                />
              ) : (
                <span className="flex-1 text-sm">{step.label}</span>
              )}
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-30"
                  aria-label="Move step up"
                >
                  <ChevronUp className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === steps.length - 1}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-30"
                  aria-label="Move step down"
                >
                  <ChevronDown className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                  aria-label="Remove step"
                >
                  <X className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset.key}
            type="button"
            onClick={() => add(preset.key, preset.label)}
            className="rounded-full border border-input px-2.5 py-1 text-xs hover:bg-accent hover:text-accent-foreground"
          >
            + {preset.label}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5">
        <Input
          placeholder="Custom step name"
          value={customLabel}
          onChange={(e) => setCustomLabel(e.target.value)}
          className="h-8"
        />
        <Button type="button" variant="secondary" size="sm" onClick={addCustom} disabled={!customLabel.trim()}>
          + Other
        </Button>
      </div>
    </div>
  );
}
