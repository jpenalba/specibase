import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { RawRow, validateRow } from "./validation";

// Local-file-backed store for the prototyping phase, deliberately kept
// behind the same shape a real Supabase/Postgres table would have. This
// file is the only thing that needs to change when we swap in a real
// database — nothing in the API routes or UI depends on it being JSON.

export type SampleRecord = {
  id: string;
  created_at: string;
  primary_identifier: string;
  species: string;
  latitude: number;
  longitude: number;
  [optionalField: string]: string | number;
};

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "samples.json");

function ensureStore(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, "[]", "utf-8");
  }
}

export function readSamples(): SampleRecord[] {
  ensureStore();
  const raw = fs.readFileSync(DATA_FILE, "utf-8");
  try {
    return JSON.parse(raw) as SampleRecord[];
  } catch {
    return [];
  }
}

function writeSamples(samples: SampleRecord[]): void {
  ensureStore();
  fs.writeFileSync(DATA_FILE, JSON.stringify(samples, null, 2), "utf-8");
}

export function existingIdentifiers(): Set<string> {
  return new Set(readSamples().map((s) => s.primary_identifier));
}

export type InsertResult =
  | { ok: true; sample: SampleRecord }
  | { ok: false; errors: string[] };

export function insertSample(row: RawRow): InsertResult {
  const samples = readSamples();
  const existingIds = new Set(samples.map((s) => s.primary_identifier));
  const { errors } = validateRow(row, existingIds);
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const { primary_identifier, species, latitude, longitude, ...rest } = row;
  const sample: SampleRecord = {
    id: randomUUID(),
    created_at: new Date().toISOString(),
    primary_identifier: primary_identifier.trim(),
    species: species.trim(),
    latitude: Number(latitude),
    longitude: Number(longitude),
    ...rest,
  };

  samples.push(sample);
  writeSamples(samples);
  return { ok: true, sample };
}

export type BulkImportResult = {
  inserted: SampleRecord[];
  skipped: { row: number; errors: string[] }[];
};

// Inserts rows one at a time (rather than validating all up front then
// writing once) so that a duplicate ID *within the same file* is caught
// against rows already inserted earlier in this same import.
export function insertSamplesBulk(rows: RawRow[]): BulkImportResult {
  const inserted: SampleRecord[] = [];
  const skipped: { row: number; errors: string[] }[] = [];

  rows.forEach((row, index) => {
    const result = insertSample(row);
    if (result.ok) {
      inserted.push(result.sample);
    } else {
      skipped.push({ row: index, errors: result.errors });
    }
  });

  return { inserted, skipped };
}
