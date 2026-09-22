export type StepKey =
  | "dna_extraction"
  | "gel_electrophoresis"
  | "quantification"
  | "pcr"
  | "library_prep"
  | "ddrad"
  | "sequence_capture"
  | "pooling"
  | "fragment_analysis"
  | "size_selection"
  | "sequencing"
  | "custom";

export type StepPreset = { key: StepKey; label: string };

// Offered when building/editing a workflow's steps, in this order.
// "custom" is last and, unlike the others, prompts for the lab's own label
// instead of using a fixed one — see WorkflowDialog's step builder.
export const STEP_PRESETS: StepPreset[] = [
  { key: "dna_extraction", label: "DNA extraction" },
  { key: "gel_electrophoresis", label: "Gel electrophoresis" },
  { key: "quantification", label: "Quantification" },
  { key: "pcr", label: "PCR" },
  { key: "library_prep", label: "Library prep" },
  { key: "ddrad", label: "ddRAD" },
  { key: "sequence_capture", label: "Sequence capture" },
  { key: "pooling", label: "Pooling" },
  { key: "fragment_analysis", label: "Fragment analysis" },
  { key: "size_selection", label: "Size selection" },
  { key: "sequencing", label: "Sequencing" },
  { key: "custom", label: "Other (customizable)" },
];

export function presetLabel(key: string): string | undefined {
  return STEP_PRESETS.find((p) => p.key === key)?.label;
}

export const CUSTOM_STEP_KEY: StepKey = "custom";
