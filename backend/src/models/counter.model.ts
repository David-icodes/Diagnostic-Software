import { model, Schema } from "mongoose";

/**
 * Monotonic per-key counter used to generate human-readable IDs
 * (e.g. Patient IDs like GP202600001) in a concurrency-safe way.
 */
export interface ICounter {
  key: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, required: true, default: 0 },
});

export const Counter = model<ICounter>("Counter", counterSchema);