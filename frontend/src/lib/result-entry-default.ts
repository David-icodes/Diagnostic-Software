/** Defaults apply only to new manual fields; even an explicitly saved empty value wins. */
export function initialResultText(parameter: {defaultValue?: string; resultType: string; itemType?: string; calculation?: {enabled?: boolean} | null; calculationStatus?: string}, saved: {result: unknown; resultDisplay?: string} | undefined): string {
  if (saved) {
    const value = saved.resultDisplay ?? saved.result;
    return typeof value === "string" || typeof value === "number" ? String(value) : "";
  }
  if (parameter.itemType === "SUBTITLE" || parameter.resultType === "BOOLEAN" || (parameter.calculation && parameter.calculation.enabled !== false && parameter.calculationStatus !== "PENDING")) return "";
  const value = parameter.defaultValue ?? "";
  if (["NUMBER", "RANGE"].includes(parameter.resultType) && value.trim() && !Number.isFinite(Number(value))) return "";
  return value;
}

export function initialResultBoolean(defaultValue: string | undefined, saved: {result: unknown} | undefined): boolean {
  return saved ? saved.result === true : defaultValue?.trim().toLowerCase() === "true";
}
