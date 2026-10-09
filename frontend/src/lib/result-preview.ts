import type { ReferenceResolution } from "../types/test-result";

/** Live feedback using only the numeric reference fields supplied by the backend. */
export function previewFlag(
  value: string | number | boolean | null | undefined,
  reference: ReferenceResolution,
): "in-range" | "out-of-range" | "not-comparable" {
  if (typeof value !== "number" || !Number.isFinite(value)) return "not-comparable";
  if (reference.status !== "MATCHED" || reference.valueType !== "NUMERIC") return "not-comparable";
  if (reference.valueFrom === undefined && reference.valueTo === undefined) {
    return "not-comparable";
  }
  if (reference.valueFrom !== undefined && value < reference.valueFrom) return "out-of-range";
  if (reference.valueTo !== undefined && value > reference.valueTo) return "out-of-range";
  return "in-range";
}

/** Numeric form of the entered value; narrative and non-finite input cannot compare. */
export function enteredNumber(value: string | boolean | undefined): number | undefined {
  if (typeof value === "boolean") return undefined;
  const raw = (value ?? "").trim();
  if (!raw) return undefined;
  // A grouped value can also look like a comma decimal. Do not guess its magnitude.
  if (/^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(raw)) return undefined;
  const num = Number(raw.replace(",", "."));
  return Number.isFinite(num) ? num : undefined;
}
