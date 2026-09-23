export type BioStepKey =
  | "quality_control"
  | "read_trimming"
  | "merging"
  | "assembly"
  | "mapping"
  | "snp_filtering"
  | "custom";

export type BioStepPreset = { key: BioStepKey; label: string };

// Offered when building/editing a Bioinformatic workflow's steps, in this
// order. "custom" is last and, unlike the others, prompts for the lab's
// own label instead of using a fixed one — see WorkflowDialog's step
// builder (shared with Lab Workflow via a `presets` prop).
export const BIO_STEP_PRESETS: BioStepPreset[] = [
  { key: "quality_control", label: "Quality control" },
  { key: "read_trimming", label: "Read trimming" },
  { key: "merging", label: "Merging" },
  { key: "assembly", label: "Assembly" },
  { key: "mapping", label: "Mapping" },
  { key: "snp_filtering", label: "SNP filtering" },
  { key: "custom", label: "Other (specify)" },
];

export const CUSTOM_BIO_STEP_KEY: BioStepKey = "custom";
