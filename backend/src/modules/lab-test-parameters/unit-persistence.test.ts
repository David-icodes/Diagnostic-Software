import test from 'node:test';import assert from 'node:assert/strict';import {Types} from 'mongoose';
import {LabTestParameter} from '../../models/lab-test-parameter.model';import {LabTestResult} from '../../models/lab-test-result.model';
import {LabBill} from '../../models/lab-bill.model';import {Patient} from '../../models/patient.model';import {AuditLog} from '../../models/audit-log.model';
import {updateParameter} from './lab-test-parameter.service';import {updateLabTestParameterSchema} from '../../validations/lab-test-parameter';import {getBillResultEntry} from '../test-results/test-result.service';
const query=(value:unknown)=>{const q:any={sort:()=>q,select:()=>q,exec:async()=>value};return q;};
test('authorized parameter update persists correct unit ID, reloads future unit and retains saved result unit and number',async t=>{
 const id=new Types.ObjectId(),testId=new Types.ObjectId(),patientId=new Types.ObjectId(),actor=new Types.ObjectId();
 let stored:any={_id:id,testId,parameterName:'Synthetic Unit Parameter',resultType:'NUMBER',itemType:'PARAMETER',active:true,displayOrder:1,unit:'old-unit'};let saves=0;
 const doc=()=>{const d=new LabTestParameter(stored);t.mock.method(d,'save',async()=>{stored=d.toObject();saves++;return d;});return d;};
 t.mock.method(LabTestParameter,'findById',(value:any)=>{assert.equal(String(value),String(id));return query(doc());});
 t.mock.method(LabTestParameter,'find',(filter:any)=>query(filter['calculation.dependencyIds']?[]:[doc()]));
 t.mock.method(LabTestResult,'countDocuments',()=>query(0));const audits:any[]=[];t.mock.method(AuditLog,'create',async(row:any)=>{audits.push(row);return row;});
 const updated=await updateParameter(String(id),String(actor),{unit:updateLabTestParameterSchema.parse({unit:'new-unit'}).unit});assert.equal(updated.unit,'new-unit');assert.equal(stored.unit,'new-unit');assert.equal(doc().unit,'new-unit');assert.equal(saves,1);
 const bill={_id:new Types.ObjectId(),patientId,status:'generated',billNumber:'SYN',items:[{testId,testName:'Synthetic',testCode:'SYN'}]};
 t.mock.method(LabBill,'findById',()=>query(bill));t.mock.method(Patient,'findById',()=>query({age:30,gender:'male'}));let rows:any[]=[];t.mock.method(LabTestResult,'find',()=>query(rows));
 const fresh=await getBillResultEntry(String(bill._id));assert.equal(fresh.tests[0].parameters[0].unit,'new-unit');assert.equal(fresh.tests[0].parameters[0].unitSource,'CATALOGUE');
 rows=[{parameterId:id,testId,result:12,parameterName:'Synthetic Unit Parameter',resultType:'NUMBER',unit:'old-unit'}];
 const historical=await getBillResultEntry(String(bill._id));assert.equal(historical.tests[0].parameters[0].unit,'old-unit');assert.equal(historical.tests[0].parameters[0].configuredUnit,'new-unit');assert.equal(rows[0].result,12);
 await updateParameter(String(id),String(actor),{unit:updateLabTestParameterSchema.parse({unit:''}).unit});assert.equal(stored.unit,'');assert.equal(rows[0].unit,'old-unit');assert.ok(audits.some(a=>a.action==='lab.parameter_unit_changed'));
 assert.equal(updateLabTestParameterSchema.safeParse({unit:'x'.repeat(51)}).success,false);
});

test('lipid source unit spelling persists with dependent formulas while incompatible migration stays blocked',async t=>{
 const id=new Types.ObjectId(),testId=new Types.ObjectId(),actor=new Types.ObjectId();let saves=0;
 const source=new LabTestParameter({_id:id,testId,parameterName:'Synthetic cholesterol',unit:'mg/dL',resultType:'NUMBER',itemType:'PARAMETER',active:true});
 t.mock.method(source,'save',async()=>{saves++;return source;});
 t.mock.method(LabTestParameter,'findById',()=>query(source));
 t.mock.method(LabTestParameter,'find',()=>query([{_id:new Types.ObjectId(),calculation:{dependencyIds:[String(id)]}}]));
 t.mock.method(AuditLog,'create',async()=>({}));
 await updateParameter(String(id),String(actor),{unit:'mgs/dL'});assert.equal(source.unit,'mgs/dL');assert.equal(saves,1);
 await assert.rejects(updateParameter(String(id),String(actor),{unit:'mmol/L'}),/dependent calculation/);assert.equal(saves,1);
});

test('lipid expression unit edits use the same canonical plan as execution',async t=>{
 const id=new Types.ObjectId(),testId=new Types.ObjectId(),actor=new Types.ObjectId();
 const sources=['mg/dL','mgs/dL','mg%'].map((unit,i)=>new LabTestParameter({_id:new Types.ObjectId(),testId,parameterName:'Synthetic source '+i,unit,resultType:'NUMBER',itemType:'PARAMETER',active:true}));
 const target=new LabTestParameter({_id:id,testId,parameterName:'Synthetic LDL',unit:'mg/dL',resultType:'NUMBER',itemType:'PARAMETER',active:true,calculation:{formulaId:'ldl-friedewald',dependencyIds:sources.map(s=>String(s._id)),expression:'S1 - S2 - S3 / 5'}});
 t.mock.method(LabTestParameter,'findById',()=>query(target));
 t.mock.method(LabTestParameter,'find',(filter:any)=>query(filter['calculation.dependencyIds']?[]:sources));
 let saves=0;t.mock.method(target,'save',async()=>{saves++;return target;});t.mock.method(AuditLog,'create',async()=>({}));
 await updateParameter(String(id),String(actor),{unit:'mgs/dL'});assert.equal(target.unit,'mgs/dL');assert.equal(saves,1);
 await assert.rejects(updateParameter(String(id),String(actor),{unit:'mmol/L'}),/compatible source and output units/);assert.equal(saves,1);
});

import {configureCalculation} from './lab-test-parameter.service';
import {LabTest} from '../../models/lab-test.model';
test('formula Save atomically persists ratio unit and binding, reloads it, and never writes historical results',async t=>{
 const id=new Types.ObjectId(),testId=new Types.ObjectId(),actor=new Types.ObjectId();
 const sources=['Total Cholesterol','HDL Cholesterol'].map(parameterName=>new LabTestParameter({_id:new Types.ObjectId(),testId,parameterName,unit:'mg/dL',resultType:'NUMBER',itemType:'PARAMETER',active:true}));
 let stored:any={_id:id,testId,parameterName:'CHOL/HDL Ratio',unit:'mg/dL',resultType:'NUMBER',itemType:'PARAMETER',active:true};let saves=0;
 const doc=()=>{const d=new LabTestParameter(stored);t.mock.method(d,'save',async()=>{stored=d.toObject();saves++;return d;});return d;};
 t.mock.method(LabTestParameter,'findById',()=>query(doc()));
 t.mock.method(LabTestParameter,'find',(filter:any)=>query(filter['calculation.dependencyIds']?[]:sources));
 t.mock.method(LabTest,'findById',()=>{const q:any={select:()=>q,lean:()=>q,exec:async()=>null};return q;});
 t.mock.method(AuditLog,'create',async()=>({}));
 for(const operation of ['updateOne','updateMany','findOneAndUpdate','create'] as const)t.mock.method(LabTestResult,operation,()=>{throw Error('Historical result write is forbidden');});
 const calculation:any={enabled:true,formulaId:'chol-hdl-ratio',expression:'S1 / S2',dependencyIds:sources.map(row=>String(row._id)),precision:2,overwrite:'CONFIRM'};
 await assert.rejects(configureCalculation(String(id),String(actor),calculation,'mg/dL'),/compatible source and output units/);assert.equal(saves,0);
 const result=await configureCalculation(String(id),String(actor),calculation,'ratio');
 assert.equal(result.unit,'ratio');assert.equal(stored.unit,'ratio');assert.equal(doc().unit,'ratio');assert.equal(stored.calculation.formulaId,'chol-hdl-ratio');assert.equal(saves,1);
});
