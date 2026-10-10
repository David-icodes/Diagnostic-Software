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
 * Generates a human-readable Patient ID: `GP<YYYY><5-digit sequence>`.
 * The sequence resets implicitly each year through a distinct counter key.
 * Patient IDs are always generated server-side.
 */
export async function generatePatientId(): Promise<string> {
  const year = new Date().getFullYear();
  const sequence = await nextSequence(`patient:${year}`);
  return `GP${year}${String(sequence).padStart(5, "0")}`;
}

/**
 * Generates a human-readable Bill number with a configurable prefix, e.g.
 * `OSP<YYYY><5-digit sequence>` or `VCB<YYYY><5-digit sequence>`.
 * The sequence resets implicitly each year through a distinct counter key.
 * Bill numbers are always generated server-side.
 */
export async function generateBillNumber(prefix = "OSP"): Promise<string> {
  const year = new Date().getFullYear();
  // Keep the OSP counter key unchanged so existing OSP sequences continue.
  const key = prefix === "OSP" ? `bill:${year}` : `bill:${prefix}:${year}`;
  const sequence = await nextSequence(key);
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