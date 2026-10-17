/** Display precision is metadata. Arithmetic continues to use the numeric result. */
export function validNumericDisplay(result: unknown, display: string): boolean {
  return typeof result === "number" && Number.isFinite(result) && display.length <= 2000 &&
    /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(display) && Number(display) === result;
}

export function resultDisplay(result: unknown, display?: string): string {
  if (display !== undefined && validNumericDisplay(result, display)) return display;
  return result === null || result === undefined || result === "" ? "—" : String(result);
}
