import test from 'node:test';
import assert from 'node:assert/strict';
import {recalculateConfigured, normalizeCalculationUnit} from './configured-calculations';
test('lipid bindings accept equivalent mass units, calculate LDL and ratios, and preserve inputs',()=>{
 const rows:any[]=[{parameterId:'tc',unit:'mgs/dL'},{parameterId:'hdl',unit:'mg%'},{parameterId:'tg',unit:'mg/dL'},
 {parameterId:'ldl',unit:'mg/dL',calculation:{formulaId:'ldl-friedewald',dependencyIds:['tc','hdl','tg'],expression:'S1 - S2 - S3 / 5'}},
 {parameterId:'vldl',unit:'mg/dL',calculation:{formulaId:'vldl',dependencyIds:['tg']}},
 {parameterId:'nonhdl',unit:'mg/dL',calculation:{formulaId:'non-hdl',dependencyIds:['tc','hdl']}},
 {parameterId:'ldlratio',unit:'ratio',calculation:{formulaId:'ldl-hdl-ratio',dependencyIds:['ldl','hdl']}},
 {parameterId:'ratio',unit:'ratio',calculation:{formulaId:'chol-hdl-ratio',dependencyIds:['tc','hdl']}}];
 for(const row of rows)row.parameterName=row.parameterId;
 const result=recalculateConfigured(rows,{tc:200,hdl:50,tg:150});
 assert.deepEqual(result.errors,{});assert.equal(result.values.ldl,120);assert.equal(result.values.ratio,4);assert.equal(result.values.tc,200);assert.equal(result.values.vldl,30);assert.equal(result.values.nonhdl,150);assert.equal(result.values.ldlratio,2.4);
 assert.equal(normalizeCalculationUnit('mgs / dL'),'mg/dl');
 assert.ok(recalculateConfigured(rows,{tc:200,hdl:50,tg:401}).errors.ldl);
 assert.ok(recalculateConfigured(rows,{tc:200,hdl:0,tg:150}).errors.ratio);
 rows[0].unit='mmol/L';assert.ok(recalculateConfigured(rows,{tc:200,hdl:50,tg:150}).errors.ldl);
});

import {reviewLisMessageSchema} from '../validations/whatsapp-lis';
test('sharing review preserves explicit header choice and rejects unknown options',()=>{
 const input={patientId:'a'.repeat(24),billId:'b'.repeat(24),templateName:'lab_report_ready'};
 assert.equal(reviewLisMessageSchema.parse({...input,includeHeader:false}).includeHeader,false);
 assert.equal(reviewLisMessageSchema.parse({...input,includeHeader:true}).includeHeader,true);
 assert.equal(reviewLisMessageSchema.safeParse({...input,includeHeader:'false'}).success,false);
});

import {resolveTestCalculations,formulaApproval} from './configured-calculations';
test('laboratory-approved mg/dL LDL/VLDL auto-discover with exact sources and enforce the 400 boundary',()=>{
 const rows:any[]=[['tc','Total Cholesterol (TC)','mgs/dL'],['hdl','HDL Cholesterol (HDL)','mg%'],['tg','Triglycerides (TGL)','mg/dL'],['ldl','LDL Cholesterol','mg/dL'],['vldl','VLDL Cholesterol','mg/dL']].map(([parameterId,parameterName,unit])=>({parameterId,parameterName,unit,resultType:'NUMBER',itemType:'PARAMETER',active:true}));
 const bindings=resolveTestCalculations(rows);
 for(const id of ['ldl','vldl'])assert.equal(bindings.get(id)?.status,'APPROVED');
 const effective=rows.map(row=>({...row,calculation:bindings.get(row.parameterId)?.config}));
 const result=recalculateConfigured(effective,{tc:200,hdl:50,tg:150});assert.equal(result.values.ldl,120);assert.equal(result.values.vldl,30);assert.deepEqual(result.errors,{});
 assert.ok(recalculateConfigured(effective,{tc:250,hdl:50,tg:400}).errors.ldl);
 assert.ok(recalculateConfigured(effective,{tc:200,hdl:50}).errors.ldl);
 assert.equal(formulaApproval('ldl-friedewald-mmol'),'PENDING');assert.equal(formulaApproval('chol-hdl-ratio'),'APPROVED');assert.equal(formulaApproval('ldl-hdl-ratio'),'APPROVED');assert.equal(formulaApproval('chol-tgl-ratio'),'PENDING');
 const duplicate=[...rows,{...rows[0],parameterId:'tc2'}];assert.equal(resolveTestCalculations(duplicate).has('ldl'),false);
});

test('approved ratios execute automatically in dependency order and reject zero HDL',()=>{
 const rows:any[]=[['tc','Total Cholesterol','mg/dL'],['hdl','HDL Cholesterol','mg/dL'],['tg','Triglycerides','mg/dL'],['ldl','LDL Cholesterol','mg/dL'],['tc-ratio','TC/HDL Ratio','ratio'],['ldl-ratio','LDL/HDL Ratio','ratio']].map(([parameterId,parameterName,unit])=>({parameterId,parameterName,unit,resultType:'NUMBER',active:true}));
 const bindings=resolveTestCalculations(rows),effective=rows.map(row=>({...row,calculation:bindings.get(row.parameterId)?.config}));
 assert.equal(bindings.get('tc-ratio')?.status,'APPROVED');assert.equal(bindings.get('ldl-ratio')?.status,'APPROVED');
 const result=recalculateConfigured(effective,{tc:200,hdl:50,tg:150});assert.equal(result.values['tc-ratio'],4);assert.equal(result.values['ldl-ratio'],2.4);assert.deepEqual(result.errors,{});
 assert.ok(recalculateConfigured(effective,{tc:200,hdl:0,tg:150}).errors['tc-ratio']);
});
