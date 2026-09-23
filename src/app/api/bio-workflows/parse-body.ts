import { BIO_STEP_PRESETS } from "@/lib/bio-workflow-steps";
import { NewBioStepInput } from "@/lib/bio-workflows-store";

const VALID_KEYS = new Set(BIO_STEP_PRESETS.map((p) => p.key));

// Shared by the create-workflow and add-steps endpoints — a step is only
// ever a preset key (with whatever label the client sends, normally the
// preset's own) or 'custom' with a lab-typed label.
export function parseSteps(body: unknown): NewBioStepInput[] | { error: string } {
  if (!Array.isArray(body) || body.length === 0) {
    return { error: "At least one step is required" };
  }
  const steps: NewBioStepInput[] = [];
  for (const raw of body) {
    if (!raw || typeof raw !== "object") return { error: "Invalid step" };
    const step_key = (raw as Record<string, unknown>).step_key;
    const label = (raw as Record<string, unknown>).label;
    if (typeof step_key !== "string" || !VALID_KEYS.has(step_key as never)) {
      return { error: `Unknown step "${step_key}"` };
    }
    if (typeof label !== "string" || !label.trim()) {
      return { error: "Every step needs a label" };
    }
    steps.push({ step_key, label: label.trim() });
  }
  return steps;
}

export function parseSampleIds(body: unknown): string[] | null {
  if (!body || typeof body !== "object" || !("sampleIds" in body)) return null;
  const ids = (body as { sampleIds: unknown }).sampleIds;
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string")) return null;
  return ids;
}
