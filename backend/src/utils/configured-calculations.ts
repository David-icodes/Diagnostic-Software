/** Explicit configured calculations shared with the frontend. No clinical defaults or string evaluation. */
export interface CalculationConfig { formulaId: string; dependencyIds?: string[] }
export interface CalculationParameter { parameterId: string; parameterName: string; unit?: string; itemType?: string; calculation?: CalculationConfig | null }
export type CalculationValues = Record<string, string | number | boolean | null | undefined>;
interface Formula { id: string; label: string; sources: string[]; aliases: string[][]; units: string[]; outputUnit: string; denominator?: number; compute: (v: number[]) => number }
export const CALCULATION_FORMULAS: Formula[] = [
 {id:"pcv",label:"PCV = RBC × MCV ÷ 10",sources:["RBC","MCV"],aliases:[["rbc","rbc count","red cell count","red blood cell count"],["mcv","mean corpuscular volume","mean corpuscular volume mcv"]],units:["million/ul","fl"],outputUnit:"%",compute:v=>v[0]*v[1]/10},
 {id:"mcv",label:"MCV = PCV × 10 ÷ RBC",sources:["PCV","RBC"],aliases:[["pcv","hematocrit","hematocrit pcv","packed cell volume"],["rbc","rbc count","red cell count","red blood cell count"]],units:["%","million/ul"],outputUnit:"fl",denominator:1,compute:v=>v[0]*10/v[1]},
 {id:"mch",label:"MCH = Hb × 10 ÷ RBC",sources:["Hb","RBC"],aliases:[["hb","hemoglobin","haemoglobin","hemoglobin hb"],["rbc","rbc count","red cell count","red blood cell count"]],units:["g/dl","million/ul"],outputUnit:"pg",denominator:1,compute:v=>v[0]*10/v[1]},
 {id:"mchc",label:"MCHC = Hb × 100 ÷ PCV",sources:["Hb","PCV"],aliases:[["hb","hemoglobin","haemoglobin","hemoglobin hb"],["pcv","hematocrit","hematocrit pcv","packed cell volume"]],units:["g/dl","%"],outputUnit:"g/dl",denominator:1,compute:v=>v[0]*100/v[1]},
 {id:"rdw",label:"RDW-CV = RBC volume SD ÷ MCV × 100",sources:["RBC volume SD","MCV"],aliases:[["rbc volume sd","sd of rbc volume","standard deviation of rbc volume","rbc sd"],["mcv","mean corpuscular volume","mean corpuscular volume mcv"]],units:["fl","fl"],outputUnit:"%",denominator:1,compute:v=>v[0]/v[1]*100},
 ...["neutrophil","lymphocyte","eosinophil","monocyte","basophil"].map(kind=>({id:"absolute-"+kind,label:"Absolute "+kind+" = WBC × differential % ÷ 100",sources:["WBC",kind+" %"],aliases:[["wbc","wbc count","total wbc count","total leucocyte count","total leucocyte wbc count"],[kind,kind+"s",kind+" percentage",kind+"s %"]],units:["count","%"],outputUnit:"count",compute:(v:number[])=>v[0]*v[1]/100})),
];
const normalizeName=(name:string)=>name.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
export function normalizeCalculationUnit(value?:string): string { const unit=(value??"").toLowerCase().replace(/[µμ]/g,"u").replace(/\s+/g,""); return ({"millions/ul":"million/ul","million/cumm":"million/ul","10^6/ul":"million/ul","cells/cumm":"cells/ul","/ul":"cells/ul","10^3/ul":"thousand/ul","10^9/l":"thousand/ul"} as Record<string,string>)[unit]??unit; }
function numeric(value:CalculationValues[string]) { if(typeof value!=="number"&&typeof value!=="string")return undefined;if(typeof value==="string"&&!value.trim())return undefined;const number=Number(value);return Number.isFinite(number)&&number>=0?number:undefined; }
/** Graph evaluation clears unavailable calculated outputs and never touches measured/manual values. */
export function recalculateConfigured(parameters: CalculationParameter[], entered: CalculationValues) {
 const values={...entered}; const errors:Record<string,string>={};const byId=new Map(parameters.map(p=>[p.parameterId,p]));const visiting=new Set<string>();const done=new Set<string>();
 const visit=(id:string):void=>{if(done.has(id))return;const target=byId.get(id);if(!target?.calculation)return;if(visiting.has(id)){errors[id]="Circular calculation dependency.";values[id]="";return;}visiting.add(id);
 const fail=(message:string)=>{errors[id]=message;values[id]="";};const formula=CALCULATION_FORMULAS.find(f=>f.id===target.calculation!.formulaId);
 if(!formula||target.itemType==="SUBTITLE"||target.itemType==="TEXT_AREA")fail("Unsupported calculation configuration.");
 else {
  const configuredIds=target.calculation.dependencyIds;
  const dependencies=configuredIds?.length?configuredIds.map(source=>byId.get(source)):formula.aliases.map(aliases=>{const matches=parameters.filter(p=>p.itemType!=="SUBTITLE"&&p.itemType!=="TEXT_AREA"&&aliases.includes(normalizeName(p.parameterName)));return matches.length===1?matches[0]:undefined;});
  if(dependencies.length!==formula.sources.length||dependencies.some(p=>!p || p.itemType === "SUBTITLE" || p.itemType === "TEXT_AREA"))fail("A source parameter is missing or ambiguous.");
  else {
   for(const dependency of dependencies)visit(dependency!.parameterId);
   const sourceUnits=dependencies.map(p=>normalizeCalculationUnit(p!.unit));const outputUnit=normalizeCalculationUnit(target.unit);
   const countUnits=["cells/ul","thousand/ul"];
   const unitMatch=formula.units.every((unit,index)=>unit==="count"?countUnits.includes(sourceUnits[index]):sourceUnits[index]===unit)&&(formula.outputUnit==="count"?outputUnit===sourceUnits[0]:outputUnit===formula.outputUnit);
   const inputs=dependencies.map(p=>numeric(values[p!.parameterId]));
   if(errors[id]||dependencies.some(p=>errors[p!.parameterId]))fail(errors[id]||"A source calculation is unavailable.");
   else if(!unitMatch)fail("Configure compatible source and output units.");
   else if(inputs.some(value=>value===undefined))fail("Enter valid nonnegative source values.");
   else if(formula.denominator!==undefined&&inputs[formula.denominator]===0)fail("Cannot calculate: denominator is zero.");
   else if(formula.id.startsWith("absolute-")&&inputs[1]!>100)fail("Differential percentage must be between 0 and 100.");
   else {const calculated=Math.round(formula.compute(inputs as number[])*100)/100;if(!Number.isFinite(calculated))fail("Calculated result is not finite.");else values[id]=calculated;}
  }
 }
 visiting.delete(id);done.add(id);};for(const p of parameters)if(p.calculation)visit(p.parameterId);return {values,errors};
}
