/** Exact metric scale conversions only. No analyte-specific mass/molar conversion. */
const scales: Record<string, [dimension: string, factor: number]> = {
  "g/l": ["mass-concentration", 1], "g/dl": ["mass-concentration", 10],
  "mg/l": ["mass-concentration", .001], "mg/dl": ["mass-concentration", .01],
  "ug/ml": ["mass-concentration", .001], "ng/ml": ["mass-concentration", .000001],
  "mmol/l": ["amount-concentration", 1], "umol/l": ["amount-concentration", .001],
  "cells/ul": ["cell-concentration", 1], "thousand/ul": ["cell-concentration", 1000],
  "million/ul": ["cell-concentration", 1000000],
};
export function unitScale(from: string, to: string): number | undefined {
  if (!from || !to) return undefined;
  if (from === to) return 1;
  const a = Object.hasOwn(scales,from) ? scales[from] : undefined, b = Object.hasOwn(scales,to) ? scales[to] : undefined;
  return a && b && a[0] === b[0] ? a[1] / b[1] : undefined;
}

/** Explicit configured calculations shared with the frontend. No clinical defaults or string evaluation. */
export interface CalculationConfig { enabled?:boolean; formulaId: string; dependencyIds?: string[]; precision?: number; overwrite?: string; sourceVerification?:string; expression?:string }
export interface CalculationParameter { parameterId: string; parameterName: string; unit?: string; itemType?: string; active?: boolean; resultType?: string; calculationStatus?: FormulaApproval; calculation?: CalculationConfig | null }
export type CalculationValues = Record<string, string | number | boolean | null | undefined>;

/**
 * What may happen to an already-entered value when an approved calculation is
 * applied. The default is the safe behaviour: ask before replacing. The
 * laboratory records a different policy on the binding, and that change itself
 * requires re-approval.
 */
export type CalculationOverwrite = "CONFIRM" | "CALCULATED" | "NEVER";
export const CALCULATION_OVERWRITE_POLICIES: CalculationOverwrite[] = ["CONFIRM", "CALCULATED", "NEVER"];
export function normalizeCalculationOverwrite(value?: string | null): CalculationOverwrite {
  return value === "CALCULATED" || value === "NEVER" ? value : "CONFIRM";
}
/** Decide whether applying a computed value may replace an already-entered one. */
export type OverwriteDecision = "ALLOW" | "CONFIRM" | "BLOCK";
export function overwriteDecision(policy: string | null | undefined, hasExistingValue: boolean): OverwriteDecision {
  if (!hasExistingValue) return "ALLOW";
  const normalized = normalizeCalculationOverwrite(policy);
  if (normalized === "NEVER") return "BLOCK";
  if (normalized === "CALCULATED") return "ALLOW";
  return "CONFIRM";
}
export interface Formula { expression?:string; id: string; label: string; sources: string[]; aliases: string[][]; targets?: string[]; units: string[]; outputUnit: string; allowNegative?: boolean; precision?: number; version?: string; method?: string; validate?: (v:number[])=>string|undefined; denominator?: number; compute: (v: number[]) => number }
const ABSOLUTE_COUNT_ABBREVIATIONS: Record<string, string> = {
  neutrophil: "ANC",
  lymphocyte: "ALC",
  eosinophil: "AEC",
  monocyte: "AMC",
  basophil: "ABC",
};

/**
 * Candidate target display names, matched by normalized name. `targets` drives
 * UI eligibility only — an eligible parameter with no persisted binding is shown
 * as "unconfigured", never as an approved calculation.
 */
export const CALCULATION_FORMULAS: Formula[] = [
 {id:"pcv-hb-approx",expression:"S1 * 3",label:"PCV ≈ Hb × 3 (approximation)",method:"Hb-based approximation; not a measured hematocrit",sources:["Hb"],aliases:[],targets:[],units:["g/dl"],outputUnit:"%",precision:1,compute:v=>v[0]*3},
 {id:"indirect-bilirubin",expression:"S1 - S2",label:"Indirect bilirubin = Total − Direct",sources:["Total bilirubin","Direct bilirubin"],aliases:[],targets:["Indirect Bilirubin"],units:["mg/dl","mg/dl"],outputUnit:"mg/dl",compute:v=>v[0]-v[1]},
 {id:"globulin",expression:"S1 - S2",label:"Globulin = Total protein − Albumin",sources:["Total protein","Albumin"],aliases:[],targets:["Globulin"],units:["g/dl","g/dl"],outputUnit:"g/dl",compute:v=>v[0]-v[1]},
 {id:"ag-ratio",expression:"S1 / S2",label:"A/G ratio = Albumin ÷ Globulin",sources:["Albumin","Globulin"],aliases:[],targets:["A/G Ratio","A G Ratio","AG Ratio","Albumin Globulin Ratio"],units:["g/dl","g/dl"],outputUnit:"ratio",denominator:1,compute:v=>v[0]/v[1]},
 {id:"non-hdl",expression:"S1 - S2",label:"Non-HDL = Total cholesterol − HDL",sources:["Total cholesterol","HDL"],aliases:[],targets:["Non-HDL","Non HDL","Non-HDL Cholesterol","Non HDL Cholesterol"],units:["mg/dl","mg/dl"],outputUnit:"mg/dl",compute:v=>v[0]-v[1]},
 {id:"bun-from-urea",label:"BUN = Urea × 28 ÷ 60",sources:["Urea"],aliases:[],targets:["BUN","Blood Urea Nitrogen","Blood Urea"],units:["mg/dl"],outputUnit:"mg/dl",compute:v=>v[0]*28/60},
 {id:"urea-from-bun",label:"Urea = BUN × 60 ÷ 28",sources:["BUN"],aliases:[],targets:["Urea"],units:["mg/dl"],outputUnit:"mg/dl",compute:v=>v[0]*60/28},
 {id:"eag",label:"eAG = HbA1c × 28.7 − 46.7",sources:["HbA1c"],aliases:[],targets:["Estimated Average Glucose","Estimated Average Glucose (EAG)","EAG"],units:["%"],outputUnit:"mg/dl",method:"ADAG estimate; validated HbA1c method required",validate:v=>v[0]>100?"HbA1c percentage cannot exceed 100.":undefined,compute:v=>v[0]*28.7-46.7},
 {id:"anion-gap",allowNegative:true,label:"Anion gap = Sodium − Chloride − Bicarbonate",sources:["Sodium","Chloride","Bicarbonate"],aliases:[],targets:["Anion Gap"],units:["mmol/l","mmol/l","mmol/l"],outputUnit:"mmol/l",compute:v=>v[0]-v[1]-v[2]},
 {id:"urine-acr",label:"Urine ACR = Albumin × 1000 ÷ Creatinine",sources:["Urine albumin","Urine creatinine"],aliases:[],targets:["Albumin/Creatinine Ratio","Albumin Creatinine Ratio","Urine Albumin Creatinine Ratio","Microalbumin Creatinine Ratio","ACR"],units:["mg/dl","mg/dl"],outputUnit:"mg/g",denominator:1,method:"Paired urine concentrations from the same specimen",compute:v=>v[0]*1000/v[1]},
 {id:"configured-difference",label:"Configured difference = A − B",sources:["A","B"],aliases:[],targets:[],units:["same","same"],outputUnit:"same",compute:v=>v[0]-v[1]},
 {id:"configured-ratio",label:"Configured ratio = A ÷ B",sources:["A","B"],aliases:[],targets:[],units:["same","same"],outputUnit:"ratio",denominator:1,compute:v=>v[0]/v[1]},

 /**
  * Lipid-derived parameters. Both conventional unit systems are explicit
  * formulas, never an implicit conversion: a result is only accepted when the
  * source and output units normalize to the selected formula. The Friedewald LDL
  * formulas fail closed above the conventional 400 mg/dL (4.52 mmol/L)
  * triglyceride limit and require laboratory approval before clinical use.
  */
 {id:"ldl-friedewald",expression:"S1 - S2 - S3 / 5",label:"LDL = Total cholesterol − HDL − Triglycerides ÷ 5 (Friedewald, mg/dL)",method:"Friedewald estimate; valid only with triglycerides ≤ 400 mg/dL and all inputs in mg/dL. Require laboratory approval.",sources:["Total cholesterol","HDL","Triglycerides"],aliases:[["total cholesterol","cholesterol total","cholesterol total serum","serum cholesterol","s cholesterol","tc"],["hdl","hdl cholesterol","hdl c","hdl-c","high density lipoprotein","high density lipoprotein cholesterol"],["triglycerides","triglyceride","serum triglycerides","triglycerides serum","tgl","tg","t g"]],targets:["LDL","LDL Cholesterol","LDL-C","LDL C","Calculated LDL","LDL (Calculated)"],units:["mg/dl","mg/dl","mg/dl"],outputUnit:"mg/dl",validate:v=>v[2]>400?"Friedewald LDL is not valid when triglycerides exceed 400 mg/dL.":undefined,compute:v=>v[0]-v[1]-v[2]/5},
 {id:"ldl-friedewald-mmol",expression:"S1 - S2 - S3 / 2.2",label:"LDL = Total cholesterol − HDL − Triglycerides ÷ 2.2 (Friedewald, mmol/L)",method:"Friedewald estimate; valid only with triglycerides ≤ 4.52 mmol/L and all inputs in mmol/L. Require laboratory approval.",sources:["Total cholesterol","HDL","Triglycerides"],aliases:[["total cholesterol","cholesterol total","cholesterol total serum","serum cholesterol","s cholesterol","tc"],["hdl","hdl cholesterol","hdl c","hdl-c","high density lipoprotein","high density lipoprotein cholesterol"],["triglycerides","triglyceride","serum triglycerides","triglycerides serum","tgl","tg","t g"]],targets:["LDL","LDL Cholesterol","LDL-C","LDL C","Calculated LDL","LDL (Calculated)"],units:["mmol/l","mmol/l","mmol/l"],outputUnit:"mmol/l",validate:v=>v[2]>4.52?"Friedewald LDL is not valid when triglycerides exceed 4.52 mmol/L.":undefined,compute:v=>v[0]-v[1]-v[2]/2.2},
 {id:"vldl",expression:"S1 / 5",label:"VLDL ≈ Triglycerides ÷ 5 (mg/dL)",method:"Triglyceride-based VLDL estimate; all inputs in mg/dL. Require laboratory approval.",sources:["Triglycerides"],aliases:[["triglycerides","triglyceride","serum triglycerides","triglycerides serum","tgl","tg","t g"]],targets:["VLDL","VLDL Cholesterol","VLDL-C","VLDL C"],units:["mg/dl"],outputUnit:"mg/dl",compute:v=>v[0]/5},
 {id:"vldl-mmol",expression:"S1 / 2.2",label:"VLDL ≈ Triglycerides ÷ 2.2 (mmol/L)",method:"Triglyceride-based VLDL estimate; all inputs in mmol/L. Require laboratory approval.",sources:["Triglycerides"],aliases:[["triglycerides","triglyceride","serum triglycerides","triglycerides serum","tgl","tg","t g"]],targets:["VLDL","VLDL Cholesterol","VLDL-C","VLDL C"],units:["mmol/l"],outputUnit:"mmol/l",compute:v=>v[0]/2.2},
 {id:"chol-hdl-ratio",expression:"S1 / S2",label:"Total cholesterol / HDL ratio",method:"Calculated ratio from total cholesterol and HDL in the same unit. Require laboratory approval.",sources:["Total cholesterol","HDL"],aliases:[["total cholesterol","cholesterol total","cholesterol total serum","serum cholesterol","s cholesterol","tc"],["hdl","hdl cholesterol","hdl c","hdl-c","high density lipoprotein","high density lipoprotein cholesterol"]],targets:["CHOL/HDL RATIO","CHOL HDL RATIO","TC/HDL Ratio","TC HDL Ratio","Total Cholesterol HDL Ratio","Cholesterol HDL Ratio"],units:["same","same"],outputUnit:"ratio",denominator:1,compute:v=>v[0]/v[1]},
 {id:"ldl-hdl-ratio",expression:"S1 / S2",label:"LDL / HDL ratio",method:"Calculated ratio from LDL and HDL in the same unit. Require laboratory approval.",sources:["LDL","HDL"],aliases:[["ldl","ldl cholesterol","ldl c","ldl-c","low density lipoprotein","low density lipoprotein cholesterol","calculated ldl"],["hdl","hdl cholesterol","hdl c","hdl-c","high density lipoprotein","high density lipoprotein cholesterol"]],targets:["LDL/HDL RATIO","LDL HDL RATIO","LDL/HDL Ratio","LDL HDL Ratio"],units:["same","same"],outputUnit:"ratio",denominator:1,compute:v=>v[0]/v[1]},
 {id:"chol-tgl-ratio",expression:"S1 / S2",label:"Total cholesterol / triglyceride ratio",method:"Calculated ratio from total cholesterol and triglycerides in the same unit. Require laboratory approval.",sources:["Total cholesterol","Triglycerides"],aliases:[["total cholesterol","cholesterol total","cholesterol total serum","serum cholesterol","s cholesterol","tc"],["triglycerides","triglyceride","serum triglycerides","triglycerides serum","tgl","tg","t g"]],targets:["CHOL/TGL RATIO","CHOL TGL RATIO","TC/TG Ratio","TC TG Ratio","Cholesterol Triglyceride Ratio","Total Cholesterol Triglycerides Ratio"],units:["same","same"],outputUnit:"ratio",denominator:1,compute:v=>v[0]/v[1]},

 {id:"pcv",expression:"S1 * S2 / 10",label:"PCV = RBC × MCV ÷ 10",sources:["RBC","MCV"],aliases:[["rbc","rbc count","red cell count","red blood cell count"],["mcv","mean corpuscular volume","mean corpuscular volume mcv"]],targets:["PCV","Hematocrit","Hematocrit (PCV)","Hematocrit ( PCV )","Packed Cell Volume","P C V","HCT"],units:["million/ul","fl"],outputUnit:"%",compute:v=>v[0]*v[1]/10},
 {id:"mcv",expression:"S1 * 10 / S2",label:"MCV = PCV × 10 ÷ RBC",sources:["PCV","RBC"],aliases:[["pcv","hematocrit","hematocrit pcv","packed cell volume"],["rbc","rbc count","red cell count","red blood cell count"]],targets:["MCV","Mean Corpuscular Volume","Mean Corpuscular Volume (MCV)","Mean Corpuscular Volume(MCV)","Mean Cell Volume","M C V","M.C.V"],units:["%","million/ul"],outputUnit:"fl",denominator:1,compute:v=>v[0]*10/v[1]},
 {id:"mch",expression:"S1 * 10 / S2",label:"MCH = Hb × 10 ÷ RBC",sources:["Hb","RBC"],aliases:[["hb","hemoglobin","haemoglobin","hemoglobin hb"],["rbc","rbc count","red cell count","red blood cell count"]],targets:["MCH","Mean Corpuscular Hemoglobin","Mean Corpuscular Haemoglobin","Mean Corpuscular Hemoglobin (MCH)","Mean Corpuscular Hemoglobin(MCH)","Mean Corpuscular Haemoglobin (MCH)","Mean Cell Hemoglobin","Mean Cell Haemoglobin","M C H","M.C.H"],units:["g/dl","million/ul"],outputUnit:"pg",denominator:1,compute:v=>v[0]*10/v[1]},
 {id:"mchc",expression:"S1 * 100 / S2",label:"MCHC = Hb × 100 ÷ PCV",sources:["Hb","PCV"],aliases:[["hb","hemoglobin","haemoglobin","hemoglobin hb"],["pcv","hematocrit","hematocrit pcv","packed cell volume"]],targets:["MCHC","Mean Corpuscular Hemoglobin Concentration","Mean Corpuscular Haemoglobin Concentration","Mean Corpuscular Hemoglobin Concentration (MCHC)","Mean Corpuscular Hemoglobin Concentration(MCHC)","Mean Corpuscular Haemoglobin Concentration (MCHC)","Mean Cell Hemoglobin Concentration","Mean Cell Haemoglobin Concentration","M C H C","M.C.H.C"],units:["g/dl","%"],outputUnit:"g/dl",denominator:1,compute:v=>v[0]*100/v[1]},
 {id:"rdw",label:"RDW-CV = RBC volume SD ÷ MCV × 100",sources:["RBC volume SD","MCV"],aliases:[["rbc volume sd","sd of rbc volume","standard deviation of rbc volume","rbc sd"],["mcv","mean corpuscular volume","mean corpuscular volume mcv"]],targets:["RDW","RDW-CV","RDW - CV","RDW CV","R D W","Red Cell Distribution Width","Red Cell Distribution Width (RDW-CV)","Red Cell Distribution Width(RDW-CV)","Red Blood Cell Distribution Width"],units:["fl","fl"],outputUnit:"%",denominator:1,compute:v=>v[0]/v[1]*100},
 ...["neutrophil","lymphocyte","eosinophil","monocyte","basophil"].map(kind=>({id:"absolute-"+kind,label:"Absolute "+kind+" = WBC × differential % ÷ 100",sources:["WBC",kind+" %"],aliases:[["wbc","wbc count","total wbc count","total leucocyte count","total leucocyte wbc count"],[kind,kind+"s",kind+" percentage",kind+"s %"]],targets:["Absolute "+kind+" Count","Absolute "+kind,ABSOLUTE_COUNT_ABBREVIATIONS[kind]],units:["count","%"],outputUnit:"count",compute:(v:number[])=>v[0]*v[1]/100})),
];
for(const formula of CALCULATION_FORMULAS){formula.version="1";formula.precision??=2;formula.method??="Explicit laboratory configuration required";}
const normalizeName=(name:string)=>name.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();

/**
 * Approval status of a centrally predefined formula mapping. Only APPROVED
 * mappings are executable for clinical results; PENDING is shown but not
 * executable; BLOCKED is not offered at all.
 */
export type FormulaApproval = "APPROVED" | "PENDING" | "BLOCKED" | "DEVELOPMENT";

/**
 * The central formula registry. A mapping is defined once here and applies to
 * every test whose parameters match by the formula's approved source/target
 * aliases — no per-test database binding is required. Only verified mappings are
 * APPROVED; the rest stay PENDING or BLOCKED.
 */
export const FORMULA_APPROVAL: Record<string, FormulaApproval> = {
  mch: "APPROVED",
  mchc: "APPROVED",
  pcv: "APPROVED",
  // Lipid formulas are implemented but intentionally not clinically executable
  // until the laboratory approves the method, unit system and Friedewald limit.
  "ldl-friedewald": "PENDING",
  "ldl-friedewald-mmol": "PENDING",
  vldl: "PENDING",
  "vldl-mmol": "PENDING",
  "chol-hdl-ratio": "PENDING",
  "ldl-hdl-ratio": "PENDING",
  "chol-tgl-ratio": "PENDING",
};
export function formulaApproval(formulaId: string): FormulaApproval {
  return FORMULA_APPROVAL[formulaId] ?? "BLOCKED";
}

/** UI eligibility, formula configuration and calculation execution are separate
 * concerns. `configured` means an executable approved calculation is available
 * (a persisted approved binding or an approved registry mapping); `pending` is a
 * registry mapping that is visible but not yet authorized for clinical use. */
export type CalculatorControlState =
  | { status: "ineligible" }
  | { status: "unconfigured" }
  | { status: "pending" }
  | { status: "configured" };

/** Normalized name with trailing "(abbreviation)" groups removed so "MCH" and
 * "Mean Corpuscular Hemoglobin(MCH)" classify alike without matching a bare
 * measured source such as "Hemoglobin". */
const calculatorNameKey = (name: string): string => {
  let result = name;
  for (;;) {
    const stripped = result.replace(/\s*\([^)]*\)\s*$/, "").trim();
    if (stripped === result) break;
    result = stripped;
  }
  return normalizeName(result);
};

/** Name-only candidate check. It never selects a source or approves a formula. */
export function isCalculatorCandidate(parameter: CalculationParameter): boolean {
  if (parameter.itemType === "SUBTITLE" || parameter.itemType === "TEXT_AREA") return false;
  const name = calculatorNameKey(parameter.parameterName);
  if (!name) return false;
  return CALCULATION_FORMULAS.some(formula =>
    (formula.targets ?? []).some(target => calculatorNameKey(target) === name),
  );
}

export function calculatorControlState(parameter: CalculationParameter): CalculatorControlState {
  if (parameter.active === false || parameter.calculation?.enabled === false) return {status:"ineligible"};
  if (parameter.calculation && CALCULATION_FORMULAS.some(formula => formula.id === parameter.calculation!.formulaId)) {
    return parameter.calculationStatus === "PENDING" ? { status: "pending" } : { status: "configured" };
  }
  if (!isCalculatorCandidate(parameter)) return { status: "ineligible" };
  const candidateApprovals = targetFormulaIds(parameter).map(formulaApproval);
  // Registry formulas that exist but are not approved are visible as pending,
  // never as an executable/unconfigured calculation.
  return candidateApprovals.length && candidateApprovals.every(status => status === "PENDING")
    ? { status: "pending" }
    : { status: "unconfigured" };
}

/** Every predefined formula whose target aliases match this parameter, in
 * registry order. Unit-specific variants (mg/dL and mmol/L) share a target name;
 * execution picks the variant whose units match, never a silent conversion. */
export function targetFormulaIds(target: CalculationParameter): string[] {
  if (target.itemType === "SUBTITLE" || target.itemType === "TEXT_AREA") return [];
  const name = calculatorNameKey(target.parameterName);
  if (!name) return [];
  return CALCULATION_FORMULAS
    .filter(formula => (formula.targets ?? []).some(candidate => calculatorNameKey(candidate) === name))
    .map(formula => formula.id);
}

/** The first predefined formula whose target aliases match this parameter. */
export function targetFormulaId(target: CalculationParameter): string | undefined {
  return targetFormulaIds(target)[0];
}

/** Ordered source IDs from the formula's approved name aliases. Requires exactly
 * one active numeric in-test parameter per source slot; ambiguity resolves to
 * nothing rather than guessing. */
export function resolveSourcesByName(parameters: CalculationParameter[], formula: Formula): string[] | undefined {
  const matches = formula.aliases.map(aliases => parameters.filter(row =>
    row.active !== false
    && row.itemType !== "SUBTITLE" && row.itemType !== "TEXT_AREA"
    && (!row.resultType || ["NUMBER", "RANGE"].includes(row.resultType))
    && aliases.includes(normalizeName(row.parameterName))));
  if (!matches.length || !matches.every(rows => rows.length === 1)) return undefined;
  return matches.map(rows => rows[0].parameterId);
}

export interface ResolvedCalculation { config: CalculationConfig; status: FormulaApproval }

/**
 * Centrally resolve every calculable target in a test. A persisted approved
 * binding wins; otherwise the predefined registry mapping is used when its exact
 * sources and units are present. This is what removes the need to configure a
 * binding for every test — the mapping is defined once in the registry.
 */
export function resolveTestCalculations(parameters: CalculationParameter[]): Map<string, ResolvedCalculation> {
  const byId = new Map(parameters.map(row => [row.parameterId, row]));
  const resolved = new Map<string, ResolvedCalculation>();
  for (const target of parameters) {
    if (target.calculation?.enabled === false) continue;
    if (target.calculation) {
      resolved.set(target.parameterId, { config: target.calculation, status: target.calculationStatus === "DEVELOPMENT" ? "DEVELOPMENT" : target.calculationStatus === "PENDING" ? "PENDING" : "APPROVED" });
      continue;
    }
    // Registry discovery must validate the target as well as its sources.
    // A known display alias does not turn legacy text or inactive content into
    // a numeric calculated result.
    if (target.active === false || target.itemType === "SUBTITLE" || target.itemType === "TEXT_AREA"
      || (target.resultType !== undefined && !["NUMBER", "RANGE"].includes(target.resultType))) continue;
    const candidates = targetFormulaIds(target)
      .map(id => CALCULATION_FORMULAS.find(row => row.id === id))
      .filter((formula): formula is Formula => formula !== undefined && formulaApproval(formula.id) !== "BLOCKED");
    for (const formula of candidates) {
      const dependencyIds = resolveSourcesByName(parameters, formula);
      if (!dependencyIds || hasDuplicateCalculationSources(dependencyIds)) continue;
      if (dependencyIds.includes(target.parameterId)) continue;
      const sourceUnits = dependencyIds.map(id => normalizeCalculationUnit(byId.get(id)?.unit));
      if (!calculationUnitsMatch(formula, sourceUnits, normalizeCalculationUnit(target.unit))) continue;
      resolved.set(target.parameterId, {
        config: { formulaId: formula.id, dependencyIds, precision: formula.precision ?? 2, overwrite: "CONFIRM" },
        status: formulaApproval(formula.id),
      });
      break;
    }
  }
  return resolved;
}

/** A source ID used for two different source slots would silently reuse one
 * parameter and produce a wrong result, so it is rejected in review, on save and
 * during execution. */
export function hasDuplicateCalculationSources(ids: readonly string[]): boolean {
 const seen=new Set<string>();for(const id of ids){if(seen.has(id))return true;seen.add(id);}return false;
}
/**
 * Resolve sources from the binding's explicit, ordered IDs only. Name-based
 * matching is never used at execution time: a binding with no configured source
 * IDs resolves to nothing and fails closed. This is what keeps a saved binding
 * tied to the exact parameters the laboratory approved, not to a display name.
 */
export function resolveCalculationDependencyIds(_parameters:CalculationParameter[],target:CalculationParameter):string[]{
 const ids=target.calculation?.dependencyIds??[];
 if(!ids.length)return [];
 return hasDuplicateCalculationSources(ids)?[]:ids;
}
export function normalizeCalculationUnit(value?:string): string { const unit=(value??"").toLowerCase().replace(/[µμ]/g,"u").replace(/\s+/g,""); return ({"×10⁶/ul":"million/ul","×10³/ul":"thousand/ul","millions/ul":"million/ul","million/cumm":"million/ul","10^6/ul":"million/ul","cells/cumm":"cells/ul","/ul":"cells/ul","10^3/ul":"thousand/ul","10^9/l":"thousand/ul", "":"","1":"ratio","gm/dl":"g/dl","gms/dl":"g/dl","mgs/dl":"mg/dl","mg%":"mg/dl","mgs%":"mg/dl"} as Record<string,string>)[unit]??unit; }
/** CBP units remain display metadata, never arithmetic operands. */
export function isNumericOnlyCalculation(id:string):boolean { return ["pcv-hb-approx","mch","mcv","mchc"].includes(id); }
/** Describe normalization without changing the persisted binding or source values. */
export function calculationUnitPlan(formula:Formula, sourceUnits:string[], outputUnit:string) {
 const units=sourceUnits.map(normalizeCalculationUnit),out=normalizeCalculationUnit(outputUnit);
 const canonical=formula.units.map(unit=>unit==="same"?units[0]:unit==="count"?"cells/ul":unit);
 const factors=units.map((unit,index)=>unitScale(unit,canonical[index]));
 const resultUnit=formula.outputUnit==="same"?canonical[0]:formula.outputUnit==="count"?"cells/ul":formula.outputUnit;
 const outputFactor=unitScale(resultUnit,out);
 if(units.length!==formula.sources.length || factors.some(f=>f===undefined) || outputFactor===undefined)return undefined;
 return {factors:factors as number[],outputFactor,units:canonical};
}
export function calculationUnitsMatch(formula:Formula, sourceUnits:string[], outputUnit:string):boolean {
 return Boolean(calculationUnitPlan(formula,sourceUnits,outputUnit));
}

function numeric(value:CalculationValues[string]) { if(typeof value!=="number"&&typeof value!=="string")return undefined;if(typeof value==="string"&&!value.trim())return undefined;const number=Number(value);return Number.isFinite(number)&&number>=0?number:undefined; }
/** Decimal shifting avoids 1.005 * 100 becoming 100.49999999999999. */
export function roundCalculationValue(value:number,precision:number):number {
 if (!Number.isInteger(precision) || precision<0 || precision>6 || !Number.isFinite(value)) return NaN;
 const [mantissa,exponent="0"]=Math.abs(value).toString().split("e");
 const shifted=Number(`${mantissa}e${Number(exponent)+precision}`);
 const [rounded,roundedExponent="0"]=Math.round(shifted).toString().split("e");
 return Math.sign(value)*Number(`${rounded}e${Number(roundedExponent)-precision}`);
}
/** Graph evaluation clears unavailable calculated outputs and never touches measured/manual values. */
export function recalculateConfigured(parameters: CalculationParameter[], entered: CalculationValues) {
 const values={...entered}; const errors:Record<string,string>={};const byId=new Map(parameters.map(p=>[p.parameterId,p]));const visiting=new Set<string>();const done=new Set<string>();
 const visit=(id:string):void=>{if(done.has(id))return;const target=byId.get(id);if(!target?.calculation || target.calculation.enabled === false)return;if(visiting.has(id)){errors[id]="Circular calculation dependency.";values[id]="";return;}visiting.add(id);
   const fail=(message:string)=>{errors[id]=message;values[id]="";};const formula=CALCULATION_FORMULAS.find(f=>f.id===target.calculation!.formulaId);
   if(target.active===false)fail("Inactive parameters cannot calculate.");
   else if(!formula||target.itemType==="SUBTITLE"||target.itemType==="TEXT_AREA")fail("Unsupported calculation configuration.");
   else if(formula.id==="rdw" && !target.calculation.sourceVerification?.trim())fail("RDW-CV is blocked until the RBC volume-distribution SD source and analyzer method are verified.");
   else {
  const dependencies=resolveCalculationDependencyIds(parameters,target).map(source=>byId.get(source));
  if(dependencies.length!==formula.sources.length||dependencies.some(p=>!p || p.itemType === "SUBTITLE" || p.itemType === "TEXT_AREA"))fail("A source parameter is missing or ambiguous.");
  else if(dependencies.some(p=>p!.active===false))fail("Inactive source parameters cannot calculate.");
  else {
   for(const dependency of dependencies)visit(dependency!.parameterId);
   const sourceUnits=isNumericOnlyCalculation(formula.id)?[]:dependencies.map(p=>normalizeCalculationUnit(p!.unit));const outputUnit=isNumericOnlyCalculation(formula.id)?"":normalizeCalculationUnit(target.unit);
   const unitMatch=isNumericOnlyCalculation(formula.id)||calculationUnitsMatch(formula,sourceUnits,outputUnit);
   const plan=isNumericOnlyCalculation(formula.id)?undefined:calculationUnitPlan(formula,sourceUnits,outputUnit);
   const inputs=dependencies.map((p,index)=>{const value=numeric(values[p!.parameterId]);return value===undefined?undefined:value*(plan?.factors[index]??1);});
   if(errors[id]||dependencies.some(p=>errors[p!.parameterId]))fail(errors[id]||"A source calculation is unavailable.");
   else if(!unitMatch)fail("Configure compatible source and output units.");
   else if(inputs.some(value=>value===undefined))fail("Enter valid nonnegative source values.");
   else if(formula.denominator!==undefined&&inputs[formula.denominator]===0)fail("Cannot calculate: denominator is zero.");
   else if(formula.id.startsWith("absolute-")&&inputs[1]!>100)fail("Differential percentage must be between 0 and 100.");
   else if(formula.validate?.(inputs as number[]))fail(formula.validate(inputs as number[])!);
   else {try {const raw=target.calculation.expression ? (isNumericOnlyCalculation(formula.id) ? evaluateFormulaExpression(target.calculation.expression,inputs as number[],[],true).value : evaluateProposedExpression(target.calculation.expression,formula.expression??"",inputs as number[],plan?.units??sourceUnits)) : formula.compute(inputs as number[]);const calculated=roundCalculationValue(raw*(plan?.outputFactor??1),target.calculation.precision??formula.precision??2);if(!Number.isFinite(calculated)||(!formula.allowNegative&&calculated<0))fail("Calculated result is not a valid nonnegative number.");else values[id]=calculated;}catch(error){fail(error instanceof Error?error.message:"Invalid formula expression.");}}
  }
 }
 visiting.delete(id);done.add(id);};for(const p of parameters)if(p.calculation)visit(p.parameterId);return {values,errors};
}

export interface BindingReviewParameter {
  id: string;
  unit?: string;
  active?: boolean;
  resultType: string;
  itemType?: string;
  calculation?: CalculationConfig | null;
}

/** Review explicit IDs, never guess a source from its display name. */
export function reviewCalculationBinding(parameters: BindingReviewParameter[], target: BindingReviewParameter): string[] {
 if (!target.calculation) return [];
 const formula = CALCULATION_FORMULAS.find(row => row.id === target.calculation!.formulaId);
 if (!formula) return ["Select a supported formula."];
 if (formula.id==="rdw" && !target.calculation.sourceVerification?.trim()) return ["Verify the exact RBC volume-distribution SD source and analyzer method before configuring RDW-CV. RDW-SD histogram width alone is insufficient."];
 const ids = target.calculation.dependencyIds ?? [];
 if (ids.length !== formula.sources.length || ids.some(id => !id)) return ["Select every source parameter explicitly."];
 if (ids.includes(target.id)) return ["A parameter cannot depend on itself."];
 if (hasDuplicateCalculationSources(ids)) return ["Each source parameter must be selected exactly once."];
 const sources = ids.map(id => parameters.find(row => row.id === id));
 if (sources.some(row => !row || row.active === false || (row.itemType && row.itemType !== "PARAMETER"))) return ["Sources must be active parameters in this test. Subtitles and text areas cannot be used as numeric sources."];
 const issues: string[] = [];
 if (!isNumericOnlyCalculation(formula.id) && !calculationUnitsMatch(formula, sources.map(row => row!.unit ?? ""), target.unit ?? "")) issues.push("Configure compatible source and output units.");
 const edges = new Map(parameters.map(row => [row.id, row.calculation?.dependencyIds ?? []]));
 edges.set(target.id, ids);
 const visiting = new Set<string>(), done = new Set<string>();
 const visit = (id: string): boolean => {
  if (visiting.has(id)) return true;
  if (done.has(id)) return false;
  visiting.add(id);
  if ((edges.get(id) ?? []).some(visit)) return true;
  visiting.delete(id); done.add(id); return false;
 };
 if ([...edges.keys()].some(visit)) issues.push("Circular calculation dependency is not allowed. PCV and MCV cannot calculate each other in the same configuration.");
 return issues;
}

export function calculationBindingChanged(next: CalculationConfig | null | undefined, previous: CalculationConfig | null | undefined, unit?: string, previousUnit?: string): boolean {
  if (!next) return false;
  return JSON.stringify([next.enabled !== false,next.expression??"",next.formulaId, next.dependencyIds ?? [], next.precision ?? 2, normalizeCalculationOverwrite(next.overwrite),next.sourceVerification??"", normalizeCalculationUnit(unit)]) !== JSON.stringify([previous?.enabled !== false,previous?.expression??"",previous?.formulaId, previous?.dependencyIds ?? [], previous?.precision ?? 2, normalizeCalculationOverwrite(previous?.overwrite),previous?.sourceVerification??"", normalizeCalculationUnit(previousUnit)]);
}

/** Bounded arithmetic parser. No JavaScript, functions, property access or eval. */
type Term = { value: number; dimensions: Record<string, number> };
export function evaluateFormulaExpression(expression: string, inputs: number[], units: string[] = [], numericOnly = false): Term {
  if (!expression.trim() || expression.length > 240) throw new Error("Enter a formula of at most 240 characters.");
  const text = expression.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-");
  const tokens = text.match(/S[1-9]\d*|(?:\d+(?:\.\d*)?|\.\d+)|[+*/()\-]|\S/g) ?? [];
  if (tokens.length > 100) throw new Error("Formula is too complex.");
  let position = 0, depth = 0;
  const used = new Set<number>();
  const signature = (dimensions: Record<string, number>) => JSON.stringify(Object.entries(dimensions).filter(([, value]) => value !== 0).sort());
  const primary = (): Term => {
    if (++depth > 16) throw new Error("Formula nesting is too deep.");
    const token = tokens[position++];
    let result: Term;
    if (token === "(" ) {
      result = sum();
      if (tokens[position++] !== ")") throw new Error("Close every parenthesis.");
    } else if (token === "+" || token === "-") {
      result = primary(); if (token === "-") result.value *= -1;
    } else if (/^S[1-9]\d*$/.test(token ?? "")) {
      const index = Number(token.slice(1)) - 1;
      if (index >= inputs.length || !Number.isFinite(inputs[index])) throw new Error("Select valid source variables S1, S2, … only.");
      used.add(index);
      result = { value: inputs[index], dimensions: numericOnly ? {} : { [units[index] ?? `S${index + 1}`]: 1 } };
    } else if (/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token ?? "")) result = { value: Number(token), dimensions: {} };
    else throw new Error("Use only source variables, numbers, +, −, ×, ÷ and parentheses.");
    depth--; return result;
  };
  const product = (): Term => {
    let left = primary();
    while (tokens[position] === "*" || tokens[position] === "/") {
      const operator = tokens[position++], right = primary();
      if (operator === "/" && right.value === 0) throw new Error("Cannot calculate: denominator is zero.");
      const dimensions = { ...left.dimensions };
      for (const [unit, power] of Object.entries(right.dimensions)) dimensions[unit] = (dimensions[unit] ?? 0) + (operator === "*" ? power : -power);
      left = { value: operator === "*" ? left.value * right.value : left.value / right.value, dimensions };
    }
    return left;
  };
  const sum = (): Term => {
    let left = product();
    while (tokens[position] === "+" || tokens[position] === "-") {
      const operator = tokens[position++], right = product();
      if (signature(left.dimensions) !== signature(right.dimensions)) throw new Error("Addition and subtraction require compatible units.");
      left = { value: operator === "+" ? left.value + right.value : left.value - right.value, dimensions: left.dimensions };
    }
    return left;
  };
  const result = sum();
  if (position !== tokens.length) throw new Error("Invalid formula syntax.");
  if (used.size !== inputs.length) throw new Error("The expression must use every configured source.");
  if (!Number.isFinite(result.value)) throw new Error("Calculated result must be finite.");
  return result;
}
/** Preserve the registry's dimensional contract; constants never imply conversions. */
export function evaluateProposedExpression(expression: string, baseline: string, inputs: number[], units: string[]): number {
  const proposed = evaluateFormulaExpression(expression, inputs, units);
  const expected = evaluateFormulaExpression(baseline, inputs, units);
  const signature = (dimensions: Record<string, number>) => JSON.stringify(Object.entries(dimensions).filter(([, power]) => power !== 0).sort());
  if (signature(proposed.dimensions) !== signature(expected.dimensions)) throw new Error("The proposed expression changes the registered unit relationship.");
  return proposed.value;
}

export interface CalculationProposal { parameterId:string; formulaId:string; dependencyIds:string[]; expression:string }
/** Only explicit proposals for already-executable targets, never catalogue writes. */
export function applyCalculationProposals(parameters:CalculationParameter[], proposals:CalculationProposal[]):CalculationParameter[] {
  if (new Set(proposals.map(p=>p.parameterId)).size!==proposals.length) throw new Error("Duplicate calculation proposal.");
  const result=parameters.map(parameter=>{
    const proposal=proposals.find(p=>p.parameterId===parameter.parameterId);
    if(!proposal)return parameter;
    const formula=CALCULATION_FORMULAS.find(f=>f.id===parameter.calculation?.formulaId);
    if(!parameter.calculation||proposal.formulaId!==formula?.id||!formula.expression)throw new Error("Proposals require an existing executable formula with an editable expression.");
    if(isNumericOnlyCalculation(formula.id) && (proposal.dependencyIds.length!==parameter.calculation.dependencyIds?.length || proposal.dependencyIds.some((id,index)=>id!==parameter.calculation!.dependencyIds?.[index])))throw new Error("CBP proposals must preserve the configured ordered source IDs.");
    const calculation:CalculationConfig={...parameter.calculation,dependencyIds:proposal.dependencyIds,expression:proposal.expression};
    return {...parameter,calculation};
  });
  if(proposals.some(p=>!result.some(row=>row.parameterId===p.parameterId)))throw new Error("Proposal target is not in this test.");
  const rows=result.map(p=>({...p,id:p.parameterId,resultType:p.resultType??""}));
  for(const proposal of proposals){const target=rows.find(p=>p.id===proposal.parameterId)!;if(target.active===false||(target.itemType&&target.itemType!=="PARAMETER"))throw new Error("Proposal targets must be active result parameters.");const issues=reviewCalculationBinding(rows,target);if(issues.length)throw new Error(issues[0]);}
  return result;
}
