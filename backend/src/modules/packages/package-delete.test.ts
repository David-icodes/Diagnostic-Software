import test from 'node:test';import assert from 'node:assert/strict';import {Types} from 'mongoose';
import {LabPackage} from '../../models/lab-package.model';import {deletePackage,setPackageActive} from './package.service';
test('catalogue deletion retains package and historical identity; repeated delete/reactivation is denied',async t=>{
 const id=new Types.ObjectId(),user=new Types.ObjectId();let saved=0;
 const doc:any={_id:id,active:true,name:'Synthetic retained package',amount:400,items:[{testId:new Types.ObjectId()}],save:async()=>{saved++;}};
 t.mock.method(LabPackage,'findById',()=>({exec:async()=>doc}) as any);
 t.mock.method(LabPackage,'deleteOne',()=>{throw Error('Physical deletion is forbidden');});
 await deletePackage(String(id),String(user));assert.equal(saved,1);assert.equal(doc.active,false);assert.ok(doc.deletedAt instanceof Date);assert.equal(String(doc.deletedBy),String(user));assert.equal(doc.items.length,1);assert.equal(doc.amount,400);
 await assert.rejects(deletePackage(String(id),String(user)),/not found/);await assert.rejects(setPackageActive(String(id),String(user),true),/not found/);assert.equal(saved,1);
});
