/** Explicit configured calculations shared with the frontend. No clinical defaults or string evaluation. */
export interface CalculationConfig { formulaId: string; dependencyIds?: string[]; precision?: number }
export interface CalculationParameter { parameterId: string; parameterName: string; unit?: string; itemType?: string; calculation?: CalculationConfig | null }
export type CalculationValues = Record<string, string | number | boolean | null | undefined>;
export interface Formula { id: string; label: string; sources: string[]; aliases: string[][]; units: string[]; outputUnit: string; allowNegative?: boolean; precision?: number; version?: string; method?: string; validate?: (v:number[])=>string|undefined; denominator?: number; compute: (v: number[]) => number }
export const CALCULATION_FORMULAS: Formula[] = [
 {id:"indirect-bilirubin",label:"Indirect bilirubin = Total − Direct",sources:["Total bilirubin","Direct bilirubin"],aliases:[],units:["mg/dl","mg/dl"],outputUnit:"mg/dl",compute:v=>v[0]-v[1]},
 {id:"globulin",label:"Globulin = Total protein − Albumin",sources:["Total protein","Albumin"],aliases:[],units:["g/dl","g/dl"],outputUnit:"g/dl",compute:v=>v[0]-v[1]},
 {id:"ag-ratio",label:"A/G ratio = Albumin ÷ Globulin",sources:["Albumin","Globulin"],aliases:[],units:["g/dl","g/dl"],outputUnit:"ratio",denominator:1,compute:v=>v[0]/v[1]},
 {id:"non-hdl",label:"Non-HDL = Total cholesterol − HDL",sources:["Total cholesterol","HDL"],aliases:[],units:["mg/dl","mg/dl"],outputUnit:"mg/dl",compute:v=>v[0]-v[1]},
 {id:"bun-from-urea",label:"BUN = Urea × 28 ÷ 60",sources:["Urea"],aliases:[],units:["mg/dl"],outputUnit:"mg/dl",compute:v=>v[0]*28/60},
 {id:"urea-from-bun",label:"Urea = BUN × 60 ÷ 28",sources:["BUN"],aliases:[],units:["mg/dl"],outputUnit:"mg/dl",compute:v=>v[0]*60/28},
 {id:"eag",label:"eAG = HbA1c × 28.7 − 46.7",sources:["HbA1c"],aliases:[],units:["%"],outputUnit:"mg/dl",method:"ADAG estimate; validated HbA1c method required",validate:v=>v[0]>100?"HbA1c percentage cannot exceed 100.":undefined,compute:v=>v[0]*28.7-46.7},
 {id:"anion-gap",allowNegative:true,label:"Anion gap = Sodium − Chloride − Bicarbonate",sources:["Sodium","Chloride","Bicarbonate"],aliases:[],units:["mmol/l","mmol/l","mmol/l"],outputUnit:"mmol/l",compute:v=>v[0]-v[1]-v[2]},
 {id:"urine-acr",label:"Urine ACR = Albumin × 1000 ÷ Creatinine",sources:["Urine albumin","Urine creatinine"],aliases:[],units:["mg/dl","mg/dl"],outputUnit:"mg/g",denominator:1,method:"Paired urine concentrations from the same specimen",compute:v=>v[0]*1000/v[1]},
 {id:"configured-difference",label:"Configured difference = A − B",sources:["A","B"],aliases:[],units:["same","same"],outputUnit:"same",compute:v=>v[0]-v[1]},
 {id:"configured-ratio",label:"Configured ratio = A ÷ B",sources:["A","B"],aliases:[],units:["same","same"],outputUnit:"ratio",denominator:1,compute:v=>v[0]/v[1]},

 {id:"pcv",label:"PCV = RBC × MCV ÷ 10",sources:["RBC","MCV"],aliases:[["rbc","rbc count","red cell count","red blood cell count"],["mcv","mean corpuscular volume","mean corpuscular volume mcv"]],units:["million/ul","fl"],outputUnit:"%",compute:v=>v[0]*v[1]/10},
 {id:"mcv",label:"MCV = PCV × 10 ÷ RBC",sources:["PCV","RBC"],aliases:[["pcv","hematocrit","hematocrit pcv","packed cell volume"],["rbc","rbc count","red cell count","red blood cell count"]],units:["%","million/ul"],outputUnit:"fl",denominator:1,compute:v=>v[0]*10/v[1]},
 {id:"mch",label:"MCH = Hb × 10 ÷ RBC",sources:["Hb","RBC"],aliases:[["hb","hemoglobin","haemoglobin","hemoglobin hb"],["rbc","rbc count","red cell count","red blood cell count"]],units:["g/dl","million/ul"],outputUnit:"pg",denominator:1,compute:v=>v[0]*10/v[1]},
 {id:"mchc",label:"MCHC = Hb × 100 ÷ PCV",sources:["Hb","PCV"],aliases:[["hb","hemoglobin","haemoglobin","hemoglobin hb"],["pcv","hematocrit","hematocrit pcv","packed cell volume"]],units:["g/dl","%"],outputUnit:"g/dl",denominator:1,compute:v=>v[0]*100/v[1]},
 {id:"rdw",label:"RDW-CV = RBC volume SD ÷ MCV × 100",sources:["RBC volume SD","MCV"],aliases:[["rbc volume sd","sd of rbc volume","standard deviation of rbc volume","rbc sd"],["mcv","mean corpuscular volume","mean corpuscular volume mcv"]],units:["fl","fl"],outputUnit:"%",denominator:1,compute:v=>v[0]/v[1]*100},
 ...["neutrophil","lymphocyte","eosinophil","monocyte","basophil"].map(kind=>({id:"absolute-"+kind,label:"Absolute "+kind+" = WBC × differential % ÷ 100",sources:["WBC",kind+" %"],aliases:[["wbc","wbc count","total wbc count","total leucocyte count","total leucocyte wbc count"],[kind,kind+"s",kind+" percentage",kind+"s %"]],units:["count","%"],outputUnit:"count",compute:(v:number[])=>v[0]*v[1]/100})),
];
for(const formula of CALCULATION_FORMULAS){formula.version="1";formula.precision??=2;formula.method??="Explicit laboratory configuration required";}
const normalizeName=(name:string)=>name.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
export function resolveCalculationDependencyIds(parameters:CalculationParameter[],target:CalculationParameter):string[]{
 if(target.calculation?.dependencyIds?.length)return target.calculation.dependencyIds;
 const formula=CALCULATION_FORMULAS.find(row=>row.id===target.calculation?.formulaId);if(!formula)return [];
 const matches=formula.aliases.map(aliases=>parameters.filter(row=>row.itemType!=="SUBTITLE"&&row.itemType!=="TEXT_AREA"&&aliases.includes(normalizeName(row.parameterName))));return matches.length&&matches.every(rows=>rows.length===1)?matches.map(rows=>rows[0].parameterId):[];
}
export function normalizeCalculationUnit(value?:string): string { const unit=(value??"").toLowerCase().replace(/[µμ]/g,"u").replace(/\s+/g,""); return ({"millions/ul":"million/ul","million/cumm":"million/ul","10^6/ul":"million/ul","cells/cumm":"cells/ul","/ul":"cells/ul","10^3/ul":"thousand/ul","10^9/l":"thousand/ul", "":"","1":"ratio"} as Record<string,string>)[unit]??unit; }
export function calculationUnitsMatch(formula:Formula, sourceUnits:string[], outputUnit:string):boolean {
 const units=sourceUnits.map(normalizeCalculationUnit),out=normalizeCalculationUnit(outputUnit);const counts=["cells/ul","thousand/ul"];
 return formula.units.every((unit,index)=>unit==="same"?!!units[index]&&units[index]===units[0]:unit==="count"?counts.includes(units[index]):units[index]===unit)&&(formula.outputUnit==="same"||formula.outputUnit==="count"?out===units[0]:out===formula.outputUnit);
}
function numeric(value:CalculationValues[string]) { if(typeof value!=="number"&&typeof value!=="string")return undefined;if(typeof value==="string"&&!value.trim())return undefined;const number=Number(value);return Number.isFinite(number)&&number>=0?number:undefined; }
/** Graph evaluation clears unavailable calculated outputs and never touches measured/manual values. */
export function recalculateConfigured(parameters: CalculationParameter[], entered: CalculationValues) {
 const values={...entered}; const errors:Record<string,string>={};const byId=new Map(parameters.map(p=>[p.parameterId,p]));const visiting=new Set<string>();const done=new Set<string>();
 const visit=(id:string):void=>{if(done.has(id))return;const target=byId.get(id);if(!target?.calculation)return;if(visiting.has(id)){errors[id]="Circular calculation dependency.";values[id]="";return;}visiting.add(id);
 const fail=(message:string)=>{errors[id]=message;values[id]="";};const formula=CALCULATION_FORMULAS.find(f=>f.id===target.calculation!.formulaId);
 if(!formula||target.itemType==="SUBTITLE"||target.itemType==="TEXT_AREA")fail("Unsupported calculation configuration.");
 else {
  const dependencies=resolveCalculationDependencyIds(parameters,target).map(source=>byId.get(source));
  if(dependencies.length!==formula.sources.length||dependencies.some(p=>!p || p.itemType === "SUBTITLE" || p.itemType === "TEXT_AREA"))fail("A source parameter is missing or ambiguous.");
  else {
   for(const dependency of dependencies)visit(dependency!.parameterId);
   const sourceUnits=dependencies.map(p=>normalizeCalculationUnit(p!.unit));const outputUnit=normalizeCalculationUnit(target.unit);
   const unitMatch=calculationUnitsMatch(formula,sourceUnits,outputUnit);
   const inputs=dependencies.map(p=>numeric(values[p!.parameterId]));
   if(errors[id]||dependencies.some(p=>errors[p!.parameterId]))fail(errors[id]||"A source calculation is unavailable.");
   else if(!unitMatch)fail("Configure compatible source and output units.");
   else if(inputs.some(value=>value===undefined))fail("Enter valid nonnegative source values.");
   else if(formula.denominator!==undefined&&inputs[formula.denominator]===0)fail("Cannot calculate: denominator is zero.");
   else if(formula.id.startsWith("absolute-")&&inputs[1]!>100)fail("Differential percentage must be between 0 and 100.");
   else if(formula.validate?.(inputs as number[]))fail(formula.validate(inputs as number[])!);
   else {const scale=10**(target.calculation.precision??formula.precision??2);const calculated=Math.round(formula.compute(inputs as number[])*scale)/scale;if(!Number.isFinite(calculated)||(!formula.allowNegative&&calculated<0))fail("Calculated result is not a valid nonnegative number.");else values[id]=calculated;}
  }
 }
 visiting.delete(id);done.add(id);};for(const p of parameters)if(p.calculation)visit(p.parameterId);return {values,errors};
}
