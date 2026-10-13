/** Legacy TEXT laboratory values remain eligible; headings and narratives are not numeric results. */
export function usesClinicalReference(parameter: {itemType?: string; resultType?: string; reference?: {status?: string; displayValue?: string}}): boolean {
  if (parameter.itemType === 'SUBTITLE' || parameter.itemType === 'TEXT_AREA' || parameter.resultType === 'TEXTAREA') return false;
  // Narrative TEXT parameters without a configured reference range are not clinical-reference eligible.
  if (parameter.resultType === 'TEXT' && parameter.reference && !parameter.reference.displayValue &&
      (parameter.reference.status === 'NOT_CONFIGURED' || parameter.reference.status === 'NO_MAPPING_FOR_PATIENT')) return false;
  return true;
}
