import { Patient } from "../models/patient.model";
import { patientCodeAliases } from "./patient-code";
import { Counter } from "../models/counter.model";

const MAX_SEQUENCE_RETRIES = 3;

/**
 * Allocates the next value for a named counter using an atomic
 * `findOneAndUpdate(..., { $inc: { seq: 1 } }, { upsert: true })`.
 *
 * Concurrency: the unique index on `key` plus the atomic `$inc` guarantees
 * every caller receives a distinct sequence number, even across concurrent
 * requests. If two callers upsert the same key simultaneously, only one
 * insert wins and the other receives a duplicate-key error, which is
 * retried against the now-existing document.
 */
export async function nextSequence(key: string): Promise<number> {
  for (let attempt = 0; attempt < MAX_SEQUENCE_RETRIES; attempt += 1) {
    try {
      const counter = await Counter.findOneAndUpdate(
        { key },
        { $inc: { seq: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      return counter?.seq ?? 1;
    } catch (error) {
      const duplicateKey =
        error instanceof Error && (error as { code?: number }).code === 11000;
      if (!duplicateKey || attempt === MAX_SEQUENCE_RETRIES - 1) {
        throw error;
      }
    }
  }
  throw new Error("Unable to allocate sequence");
}

/**
 * Generates a human-readable Patient ID: `GP<YYYY><minimum 4-digit sequence>`.
 * The sequence resets implicitly each year through a distinct counter key.
 * Patient IDs are always generated server-side.
 */
export async function generatePatientId(): Promise<string> {
  const year = new Date().getFullYear();
  for (let attempt=0;attempt<100;attempt++) {
    const sequence = await nextSequence(`patient:${year}`);
    const candidate=`GP${year}${String(sequence).padStart(4,"0")}`;
    // Keep the original atomic counter and skip any legacy spelling of this code.
    if (!(await Patient.exists({patientId:{$in:patientCodeAliases(candidate)}}))) return candidate;
  }
  throw new Error("Unable to allocate a unique patient ID.");
}

/**
 * Generates a human-readable Bill number with a configurable prefix.
 * OSP bills use the `DIAG<YYYY>-<sequence>` format (e.g. `DIAG2026-4329`),
 * preserving the existing `bill:<year>` counter so the sequence continues
 * from prior OSP numbers. Other prefixes (e.g. `VCB`) keep the legacy
 * `<PREFIX><YYYY><5-digit sequence>` format with their own counter key.
 * The sequence resets implicitly each year through a distinct counter key.
 * Bill numbers are always generated server-side.
 */
export async function generateBillNumber(prefix = "DIAG"): Promise<string> {
  const year = new Date().getFullYear();
  // Keep the OSP/DIAG counter key unchanged so existing sequences continue.
  const key = prefix === "DIAG" || prefix === "OSP" ? `bill:${year}` : `bill:${prefix}:${year}`;
  const sequence = await nextSequence(key);
  if (prefix === "DIAG" || prefix === "OSP") {
    return `${prefix}${year}-${sequence}`;
  }
  return `${prefix}${year}${String(sequence).padStart(5, "0")}`;
}

/**
 * Generates a human-readable Client code: `VC<YYYY><5-digit sequence>`.
 * Client codes are always generated server-side.
 */
export async function generateClientCode(): Promise<string> {
  const year = new Date().getFullYear();
  const sequence = await nextSequence(`client:${year}`);
  return `VC${year}${String(sequence).padStart(5, "0")}`;
}

/**
 * Generates a human-readable Sample ID: `SMP<YYYY><6-digit sequence>`.
 * Sample IDs are always generated server-side.
 */
export async function generateSampleId(): Promise<string> {
  const year = new Date().getFullYear();
  const sequence = await nextSequence(`sample:${year}`);
  return `SMP${year}${String(sequence).padStart(6, "0")}`;
}