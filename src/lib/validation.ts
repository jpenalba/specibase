import { OPTIONAL_FIELDS } from "./fields";
import { parseDDMMYYYY, DATE_FORMAT_LABEL } from "./dates";

export type RawRow = Record<string, string>;

export type RowValidation = {
  errors: string[];
  // Set only when the row's Sample ID collides with the database or with
  // another row in the same upload — callers use this to hard-block an
  // entire import rather than just skipping the one row.
  duplicateId?: string;
};

function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim() === "";
}

// Shared by both the client-side staging preview and the server-side
// commit, so "what counts as a valid row" is defined in exactly one place.
export function validateRow(
  row: RawRow,
  existingIds: Set<string>
): RowValidation {
  const errors: string[] = [];
  let duplicateId: string | undefined;

  const id = row.primary_identifier?.trim();
  if (isBlank(id)) {
    errors.push("Sample ID is required");
  } else if (existingIds.has(id)) {
    errors.push(`Sample ID "${id}" already exists`);
    duplicateId = id;
  }

  if (isBlank(row.species)) {
    errors.push("Species is required");
  }

  // Coordinates aren't required on their own — plenty of experimental work
  // has no meaningful lat/lon — but every sample needs to be locatable
  // *somehow*, so either both coordinates or a locality must be given.
  const latProvided = !isBlank(row.latitude);
  const lonProvided = !isBlank(row.longitude);
  const localityProvided = !isBlank(row.locality);

  if (latProvided !== lonProvided) {
    errors.push("Latitude and longitude must both be provided, or both left blank");
  } else if (latProvided && lonProvided) {
    const lat = Number(row.latitude);
    if (Number.isNaN(lat) || lat < -90 || lat > 90) {
      errors.push("Latitude must be a number between -90 and 90");
    }
    const lng = Number(row.longitude);
    if (Number.isNaN(lng) || lng < -180 || lng > 180) {
      errors.push("Longitude must be a number between -180 and 180");
    }
  } else if (!localityProvided) {
    errors.push("Provide either latitude & longitude, or a locality");
  }

  for (const field of OPTIONAL_FIELDS) {
    if (field.type !== "date") continue;
    const raw = row[field.key];
    if (isBlank(raw)) continue;
    if (parseDDMMYYYY(raw) === null) {
      errors.push(`${field.label} must be in ${DATE_FORMAT_LABEL} format`);
    }
  }

  return { errors, duplicateId };
}

export function buildTemplateHeaders(selectedOptionalKeys: string[]): string[] {
  const optional = OPTIONAL_FIELDS.filter((f) =>
    selectedOptionalKeys.includes(f.key)
  ).map((f) => f.key);
  return [
    "primary_identifier",
    "species",
    "latitude",
    "longitude",
    "locality",
    ...optional,
  ];
}
