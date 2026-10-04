/**
 * Calculated-parameter support for the Parameter Based Test Results screen.
 *
 * The formulas are fixed, explicit and named — there is no string evaluation and
 * no `eval`. Dependencies are resolved by the parameter's identity (its name,
 * normalised), never by table row position, and only when exactly one parameter
 * in the current test matches. Anything ambiguous or missing means no
 * calculator is offered, so a wrong value can never be produced silently.
 */

export interface CalcParameter {
  parameterId: string;
  parameterName: string;
}

export type CalcValue = string | number | boolean | null | undefined;
export type CalcValueMap = Record<string, CalcValue>;

export type CalculationResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

export interface ResolvedCalculation {
  /** The parameter whose result the calculator fills. */
  parameterId: string;
  parameterName: string;
  /** Human label of the formula, e.g. "PCV = RBC × MCV / 10". */
  formulaLabel: string;
  /** Parameter ids the formula reads, in order. */
  dependencyIds: string[];
  /** Human labels of the dependencies, for messages/tooltips. */
  dependencyLabels: string[];
  /** Runs the formula against the current entered values (keyed by parameter id). */
  run: (values: CalcValueMap) => CalculationResult;
}

/**
 * Normalises a parameter name for identity comparison: case, punctuation and
 * repeated whitespace are insignificant ("Mean Corpuscular Volume(MCV)" and
 * "MCV" are different names, so both spellings are listed as aliases rather than
 * matched by substring).
 */
export function normalizeParameterName(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface DependencySpec {
  key: string;
  label: string;
  aliases: string[];
}

interface FormulaSpec {
  id: string;
  formulaLabel: string;
  /** Names that identify the parameter the result is written to. */
  targets: string[];
  deps: DependencySpec[];
  /** Dependency keys that must not be zero. */
  denominatorKeys: string[];
  compute: (values: Record<string, number>) => number;
}

const DEP = {
  rbc: { key: "rbc", label: "Red Cell Count", aliases: ["red cell count", "rbc count", "rbc", "red blood cell count"] },
  mcv: { key: "mcv", label: "MCV", aliases: ["mcv", "mean corpuscular volume", "mean corpuscular volume mcv", "mean cell volume"] },
  pcv: { key: "pcv", label: "Hematocrit (PCV)", aliases: ["hematocrit pcv", "haematocrit pcv", "packed cell volume", "packed cell volume pcv", "hematocrit", "haematocrit", "pcv"] },
  hb: { key: "hb", label: "Hemoglobin", aliases: ["hemoglobin", "haemoglobin", "hemoglobin hb", "haemoglobin hb", "hb"] },
  wbc: { key: "wbc", label: "WBC Count", aliases: ["total leucocyte wbc count", "total wbc count", "total leucocyte count", "wbc count", "wbc"] },
  neut: { key: "neut", label: "Neutrophils %", aliases: ["neutrophils", "neutrophil", "polymorphs"] },
  lymph: { key: "lymph", label: "Lymphocytes %", aliases: ["lymphocytes", "lymphocyte"] },
  mono: { key: "mono", label: "Monocytes %", aliases: ["monocytes", "monocyte"] },
  eos: { key: "eos", label: "Eosinophils %", aliases: ["eosinophils", "eosinophil"] },
  baso: { key: "baso", label: "Basophils %", aliases: ["basophils", "basophil"] },
  sd: { key: "sd", label: "SD of RBC volume", aliases: ["sd", "sd of rbc volume", "standard deviation", "standard deviation of rbc volume", "rbc sd"] },
} satisfies Record<string, DependencySpec>;

const FORMULAS: FormulaSpec[] = [
  {
    id: "pcv",
    formulaLabel: "PCV = RBC × MCV ÷ 10",
    targets: ["hematocrit pcv", "haematocrit pcv", "packed cell volume", "packed cell volume pcv", "pcv", "hematocrit", "haematocrit"],
    deps: [DEP.rbc, DEP.mcv],
    denominatorKeys: [],
    compute: (v) => (v.rbc * v.mcv) / 10,
  },
  {
    id: "mcv",
    formulaLabel: "MCV = PCV × 10 ÷ RBC",
    targets: ["mcv", "mean corpuscular volume", "mean corpuscular volume mcv", "mean cell volume"],
    deps: [DEP.pcv, DEP.rbc],
    denominatorKeys: ["rbc"],
    compute: (v) => (v.pcv * 10) / v.rbc,
  },
  {
    id: "mch",
    formulaLabel: "MCH = Hb × 10 ÷ RBC",
    targets: ["mch", "mean corpuscular hemoglobin", "mean corpuscular haemoglobin", "mean corpuscular hemoglobin mch", "mean corpuscular haemoglobin mch"],
    deps: [DEP.hb, DEP.rbc],
    denominatorKeys: ["rbc"],
    compute: (v) => (v.hb * 10) / v.rbc,
  },
  {
    id: "mchc",
    formulaLabel: "MCHC = Hb × 100 ÷ PCV",
    targets: ["mchc", "mean corpuscular hemoglobin concentration", "mean corpuscular haemoglobin concentration", "mean corpuscular hemoglobin concentration mchc", "mean corpuscular haemoglobin concentration mchc"],
    deps: [DEP.hb, DEP.pcv],
    denominatorKeys: ["pcv"],
    compute: (v) => (v.hb * 100) / v.pcv,
  },
  {
    id: "rdw",
    formulaLabel: "RDW-CV = SD of RBC volume × 100 ÷ MCV",
    targets: ["rdw cv", "rdw", "red cell distribution width", "red cell distribution width rdw cv", "red cell distribution width rdw"],
    deps: [DEP.sd, DEP.mcv],
    denominatorKeys: ["mcv"],
    compute: (v) => (v.sd * 100) / v.mcv,
  },
  {
    id: "anc",
    formulaLabel: "ANC = WBC × Neutrophils% ÷ 100",
    targets: ["absolute neutrophil count", "absolute neutrophil count anc", "anc"],
    deps: [DEP.wbc, DEP.neut],
    denominatorKeys: [],
    compute: (v) => (v.wbc * v.neut) / 100,
  },
  {
    id: "alc",
    formulaLabel: "ALC = WBC × Lymphocytes% ÷ 100",
    targets: ["absolute lymphocyte count", "absolute lymphocyte count alc", "alc"],
    deps: [DEP.wbc, DEP.lymph],
    denominatorKeys: [],
    compute: (v) => (v.wbc * v.lymph) / 100,
  },
  {
    id: "amc",
    formulaLabel: "AMC = WBC × Monocytes% ÷ 100",
    targets: ["absolute monocyte count", "absolute monocyte count amc", "amc"],
    deps: [DEP.wbc, DEP.mono],
    denominatorKeys: [],
    compute: (v) => (v.wbc * v.mono) / 100,
  },
  {
    id: "aec",
    formulaLabel: "AEC = WBC × Eosinophils% ÷ 100",
    targets: ["absolute eosinophil count", "absolute eosinophil count aec", "aec"],
    deps: [DEP.wbc, DEP.eos],
    denominatorKeys: [],
    compute: (v) => (v.wbc * v.eos) / 100,
  },
  {
    id: "abc",
    formulaLabel: "ABC = WBC × Basophils% ÷ 100",
    targets: ["absolute basophil count", "absolute basophil count abc", "abc"],
    deps: [DEP.wbc, DEP.baso],
    denominatorKeys: [],
    compute: (v) => (v.wbc * v.baso) / 100,
  },
];

/**
 * Matches a name to at most one parameter. Returns `null` when nothing matches
 * or when several parameters share the name (ambiguous), so the caller never
 * guesses which dependency to use.
 */
function findUnique(
  parameters: CalcParameter[],
  aliases: string[],
): CalcParameter | null {
  const matches = parameters.filter((parameter) =>
    aliases.includes(normalizeParameterName(parameter.parameterName)),
  );
  return matches.length === 1 ? matches[0] : null;
}

function toNumber(value: CalcValue): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") {
    const trimmed = value.trim().replace(/,/g, ".");
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/**
 * Rounds a computed value to at most two decimals and drops trailing zeros, so a
 * calculation never shows long float noise (33.333333… → 33.33) while integer
 * results stay integers (45, 4800).
 */
export function roundCalculatedValue(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Finds every calculation that applies to the given test's parameters. A
 * calculation is offered only when its result parameter and all its dependency
 * parameters resolve to exactly one parameter each.
 */
export function resolveCalculations(
  parameters: CalcParameter[],
): ResolvedCalculation[] {
  const resolved: ResolvedCalculation[] = [];
  for (const formula of FORMULAS) {
    const target = findUnique(parameters, formula.targets);
    if (!target) continue;

    const dependencyIds: string[] = [];
    const dependencyLabels: string[] = [];
    let complete = true;
    for (const dep of formula.deps) {
      const match = findUnique(parameters, dep.aliases);
      if (!match) { complete = false; break; }
      if (match.parameterId === target.parameterId) { complete = false; break; }
      dependencyIds.push(match.parameterId);
      dependencyLabels.push(dep.label);
    }
    if (!complete) continue;

    const keyById: Record<string, string> = {};
    formula.deps.forEach((dep, index) => { keyById[dependencyIds[index]] = dep.key; });

    resolved.push({
      parameterId: target.parameterId,
      parameterName: target.parameterName,
      formulaLabel: formula.formulaLabel,
      dependencyIds,
      dependencyLabels,
      run: (values) => {
        const inputs: Record<string, number> = {};
        const missing: string[] = [];
        formula.deps.forEach((dep, index) => {
          const raw = toNumber(values[dependencyIds[index]]);
          if (raw === undefined) missing.push(dep.label);
          else inputs[dep.key] = raw;
        });
        if (missing.length > 0) {
          return { ok: false, error: `Enter ${missing.join(" and ")} first.` };
        }
        const zero = formula.denominatorKeys.find((key) => inputs[key] === 0);
        if (zero) {
          return { ok: false, error: "Cannot calculate: denominator is zero." };
        }
        const value = formula.compute(inputs);
        if (!Number.isFinite(value)) {
          return { ok: false, error: "Cannot calculate with the entered values." };
        }
        return { ok: true, value: roundCalculatedValue(value) };
      },
    });
  }
  return resolved;
}
