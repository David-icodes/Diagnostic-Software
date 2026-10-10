export function isValidObjectId(value: unknown): boolean {
  return typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
}