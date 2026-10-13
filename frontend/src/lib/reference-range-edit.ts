export interface EditableRange { from: string; to: string; text: string }
const numeric = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
const plainRange = new RegExp(`^(?:${numeric}\\s*[-–]\\s*${numeric}|(?:>=|<=|≥|≤)\\s*${numeric})$`);

/** Only explicit bound edits may replace a plain numeric display. Narrative source text is retained. */
export function editRangeBounds(current: EditableRange, patch: Partial<Pick<EditableRange, 'from' | 'to'>>): EditableRange {
  const next = { ...current, ...patch };
  if (!plainRange.test(current.text.trim())) return next;
  const from = next.from.trim(), to = next.to.trim();
  if ((from && !Number.isFinite(Number(from))) || (to && !Number.isFinite(Number(to)))) return next;
  return { ...next, text: from && to ? `${from} - ${to}` : from ? `>= ${from}` : to ? `<= ${to}` : '' };
}

export function needsExplicitRangeComposition(previous: EditableRange, current: EditableRange): boolean {
  return (previous.from !== current.from || previous.to !== current.to) &&
    previous.text === current.text && !plainRange.test(current.text.trim());
}
