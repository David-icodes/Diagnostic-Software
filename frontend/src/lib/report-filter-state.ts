/** Date-only controls use the browser's local calendar, never UTC slicing. */
export function localToday(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** Clear/unmount invalidate outstanding Show, pagination and refresh requests. */
export function requestIsCurrent(sequence: number, current: number): boolean { return sequence === current; }
