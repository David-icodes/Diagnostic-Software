import test from 'node:test';
import assert from 'node:assert/strict';
import {Types} from 'mongoose';
import {LabPackage} from '../../models/lab-package.model';
import {LabTest} from '../../models/lab-test.model';
import {Department} from '../../models/department.model';
import {resolveBillingPackage} from './package-resolution';
test('billing package resolves ordered current tests/departments without writes or browser object-shape dependencies',async t=>{
 const id=new Types.ObjectId(),a=new Types.ObjectId(),b=new Types.ObjectId(),d1=new Types.ObjectId(),d2=new Types.ObjectId();let disabled=false,missing=false,duplicate=false;
 t.mock.method(LabPackage,'findOne',()=>({exec:async()=>({_id:id,name:'Synthetic',amount:500,items:[{testId:a,departmentId:d2},{testId:duplicate?a:b,departmentId:d1}]})}) as any);
 t.mock.method(LabTest,'find',()=>({exec:async()=>[{_id:a,testName:'A',departmentId:d1},{_id:b,testName:'B',departmentId:d2,active:!disabled}]}) as any);
 t.mock.method(Department,'find',()=>({exec:async()=>[{_id:d1,name:'H'},...missing?[]:[{_id:d2,name:'C'}]]}) as any);
 t.mock.method(LabPackage,'updateOne',()=>{throw Error('No writes permitted');});
 const result=await resolveBillingPackage(String(id));assert.equal(result.amount,500);assert.deepEqual(result.members.map(x=>x.departmentName),['H','C']);
 disabled=true;assert.equal((await resolveBillingPackage(String(id))).members.length,2);disabled=false;
 missing=true;await assert.rejects(resolveBillingPackage(String(id)),/department/);missing=false;
 duplicate=true;await assert.rejects(resolveBillingPackage(String(id)),/duplicate/);
});
