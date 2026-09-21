import { FOCAL_GROUP_CATEGORIES, FocalGroupCategory } from "@/lib/focal-group";
import { ProjectStatus } from "@/lib/projects-store";

const STATUSES: ProjectStatus[] = ["in_progress", "completed"];

// Distinguishes "this key wasn't in the request at all" (undefined — skip
// it on an update) from "it was sent as an empty string" (still undefined
// after trimming, but createProject/updateProject turn that into null,
// clearing the field) — collapsing both to undefined up front would make
// clearing a field on an edit indistinguishable from not touching it.
function stringField(body: Record<string, unknown>, key: string): string | undefined {
  if (!(key in body)) return undefined;
  const value = body[key];
  return typeof value === "string" ? value : undefined;
}

export type ParsedProjectFields = {
  description?: string;
  start_date?: string;
  owner?: string;
  collaborators?: string;
  focal_group?: string;
  focal_region?: string;
  logo?: FocalGroupCategory | null;
  status?: ProjectStatus;
};

// Shared between POST (create) and PATCH (update) — pulls the project
// detail fields out of a request body and validates the two enum-like
// ones (logo, status) rather than trusting whatever a client sends.
export function parseProjectFields(
  body: Record<string, unknown>
): ParsedProjectFields | { error: string } {
  let logo: FocalGroupCategory | null | undefined;
  if ("logo" in body) {
    if (body.logo === null || body.logo === "") {
      logo = null;
    } else if (typeof body.logo === "string" && FOCAL_GROUP_CATEGORIES.includes(body.logo as FocalGroupCategory)) {
      logo = body.logo as FocalGroupCategory;
    } else {
      return { error: `Unknown logo "${body.logo}"` };
    }
  }

  let status: ProjectStatus | undefined;
  if ("status" in body) {
    if (typeof body.status === "string" && STATUSES.includes(body.status as ProjectStatus)) {
      status = body.status as ProjectStatus;
    } else {
      return { error: `Unknown status "${body.status}"` };
    }
  }

  return {
    description: stringField(body, "description"),
    start_date: stringField(body, "start_date"),
    owner: stringField(body, "owner"),
    collaborators: stringField(body, "collaborators"),
    focal_group: stringField(body, "focal_group"),
    focal_region: stringField(body, "focal_region"),
    logo,
    status,
  };
}
