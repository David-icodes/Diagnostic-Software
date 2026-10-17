/** Narrative defaults are display text, never numeric results or clinical ranges. */
export function isReportNarrative(parameter: {itemType?: string; resultType?: string}) {
  return parameter.itemType === "TEXT_AREA" || parameter.resultType === "TEXTAREA";
}
export function reportNarrative(parameter: {defaultValue?: string}, result?: {result?: unknown}) {
  // An explicitly saved empty string is a deliberate clear, not a missing result.
  return result && result.result !== undefined && result.result !== null
    ? String(result.result) : parameter.defaultValue ?? "";
}
