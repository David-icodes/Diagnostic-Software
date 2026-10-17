import test from 'node:test';
import assert from 'node:assert/strict';
import {CALCULATION_FORMULAS,recalculateConfigured} from './configured-calculations';
const cases=[
 {id:'indirect-bilirubin',inputs:[1.2,.3],units:['mg/dl','mg/dl'],output:'mg/dl',expected:.9},
 {id:'globulin',inputs:[7,4],units:['g/dl','g/dl'],output:'g/dl',expected:3},
 {id:'ag-ratio',inputs:[4,3],units:['g/dl','g/dl'],output:'ratio',expected:1.33},
 {id:'non-hdl',inputs:[200,50],units:['mg/dl','mg/dl'],output:'mg/dl',expected:150},
];
for(const row of cases)test('preserved verified registry formula '+row.id,()=>{
 assert.equal(CALCULATION_FORMULAS.filter(f=>f.id===row.id).length,1);
 const parameters=row.units.map((unit,i)=>({parameterId:'synthetic-'+i,parameterName:'Synthetic source '+i,resultType:'NUMBER',unit}));
 const target={parameterId:'synthetic-target',parameterName:'Synthetic target',resultType:'NUMBER',unit:row.output,calculation:{formulaId:row.id,dependencyIds:parameters.map(p=>p.parameterId),precision:2}};
 const all=[...parameters,target];const values=Object.fromEntries(parameters.map((p,i)=>[p.parameterId,row.inputs[i]]));
 const calculated=recalculateConfigured(all,values);assert.deepEqual(calculated.errors,{});assert.equal(calculated.values[target.parameterId],row.expected);
 const configured=all.map(p=>p.parameterId===target.parameterId?{...target,calculation:{...target.calculation,expression:CALCULATION_FORMULAS.find(f=>f.id===row.id)!.expression}}:p);
 assert.equal(recalculateConfigured(configured,values).values[target.parameterId],row.expected);
 assert.deepEqual(recalculateConfigured(configured,values).errors,{});

 for(const p of parameters)assert.equal(calculated.values[p.parameterId],values[p.parameterId]);
 assert.ok(recalculateConfigured(all,{}).errors[target.parameterId]);
 assert.ok(recalculateConfigured(all,{...values,'synthetic-0':'not numeric'}).errors[target.parameterId]);
 if(row.id==='ag-ratio')assert.ok(recalculateConfigured(all,{...values,'synthetic-1':0}).errors[target.parameterId]);
});
