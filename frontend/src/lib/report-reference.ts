/** Consume backend display text verbatim. Empty resolved text must not revive a raw master range. */
export function reportReferenceText(parameterId: string, resolved: Record<string, string> | undefined, historical?: string): string {
  return resolved && Object.hasOwn(resolved, parameterId) ? resolved[parameterId] : historical ?? "";
}
