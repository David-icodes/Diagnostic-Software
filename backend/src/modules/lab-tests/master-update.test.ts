import test from 'node:test';import assert from 'node:assert/strict';import {Types} from 'mongoose';
import {LabTest} from '../../models/lab-test.model';import {updateTest} from './lab-test.service';import {updateLabTestSchema} from '../../validations/lab-test';import {updateLabTestParameterSchema} from '../../validations/lab-test-parameter';import {readReportNotes} from '../test-results/report-notes';
test('exact test ID note update survives reload, reaches report notes, and explicit clears preserve omitted fields',async t=>{
 const id=new Types.ObjectId(),other=new Types.ObjectId(),actor=new Types.ObjectId();let stored:any={_id:id,testName:'Synthetic ESR',testCode:'SYN-ESR',shortName:'SYN',departmentId:new Types.ObjectId(),price:80,reportNote1:'Old note',reportNote2:'Retained',priceIp:100};
 t.mock.method(LabTest,'findById',(value:any)=>{assert.equal(String(value),String(id));const row=new LabTest(stored);t.mock.method(row,'save',async()=>{stored=row.toObject();return row;});return {exec:async()=>row} as any;});
 t.mock.method(LabTest,'find',(filter:any)=>{assert.deepEqual(filter._id.$in,[String(id)]);return {select:()=>({exec:async()=>[stored]})} as any;});
 const patch=updateLabTestSchema.parse({reportNote1:' Updated note '});assert.equal(Object.hasOwn(patch,'priceIp'),false);
 await updateTest(String(id),String(actor),{reportNote1:patch.reportNote1});assert.equal(stored.reportNote1,'Updated note');assert.equal(stored.priceIp,100);assert.equal(stored.reportNote2,'Retained');
 assert.equal((await readReportNotes([String(id)])).get(String(id))?.reportNote1,'Updated note');assert.equal((await readReportNotes([String(id)])).has(String(other)),false);
 const cleared=updateLabTestSchema.parse({reportNote1:'',priceIp:null});await updateTest(String(id),String(actor),{reportNote1:cleared.reportNote1,priceIp:cleared.priceIp});assert.equal(stored.reportNote1,'');assert.equal(stored.priceIp,undefined);assert.equal(stored.reportNote2,'Retained');
 const parameter=updateLabTestParameterSchema.parse({unit:'',method:'',subtitle:'',rangeFrom:null,rangeTo:null});assert.equal(parameter.method,'');assert.equal(parameter.unit,'');assert.equal(Object.hasOwn(parameter,'rangeFrom'),true);assert.equal(parameter.rangeFrom,undefined);
});
