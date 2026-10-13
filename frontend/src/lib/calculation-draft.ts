import {
  recalculateConfigured,
  resolveCalculationDependencyIds,
  type CalculationParameter,
  type CalculationValues,
} from "./configured-calculations.ts";

/** Preview from accepted table sources; never apply ancestors or descendants. */
export function previewParameterCalculation(parameters: CalculationParameter[], values: CalculationValues, parameterId: string) {
  return recalculateConfigured(parameters.map(parameter => parameter.parameterId === parameterId
    ? parameter : {...parameter, calculation: undefined}), values);
}

/** Evaluate the requested target and affected graph, retaining unrelated drafts. */
export function recalculateParameterDraft(
  parameters: CalculationParameter[],
  values: CalculationValues,
  parameterId: string,
) {
  const affected = new Set([parameterId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const parameter of parameters) {
      if (parameter.calculation && !affected.has(parameter.parameterId) &&
        resolveCalculationDependencyIds(parameters, parameter).some(id => affected.has(id))) {
        affected.add(parameter.parameterId);
        changed = true;
      }
    }
  }
  // Include calculated ancestors so the existing engine controls evaluation order.
  const required = new Set(affected);
  const includeSources = (id: string) => {
    const parameter = parameters.find(row => row.parameterId === id);
    if (!parameter?.calculation) return;
    for (const source of resolveCalculationDependencyIds(parameters, parameter)) {
      if (!required.has(source)) {
        required.add(source);
        includeSources(source);
      }
    }
  };
  for (const id of affected) includeSources(id);
  return recalculateConfigured(
    parameters.map(parameter => required.has(parameter.parameterId)
      ? parameter
      : {...parameter, calculation: undefined}),
    values,
  );
}
