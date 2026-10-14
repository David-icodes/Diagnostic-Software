import test from "node:test";
import assert from "node:assert/strict";
import mongoose, { Types } from "mongoose";
import { assertCollectionToken, recollectSample, withSampleResultWrite } from "./recollection.service";
import { LabSample } from "../../models/lab-sample.model";
import { LabBill } from "../../models/lab-bill.model";
import { LabTestResult } from "../../models/lab-test-result.model";
import { SampleCollection } from "../../models/sample-collection.model";
import { AuditLog } from "../../models/audit-log.model";

const query = (value: unknown) => { const q = { session: () => q, lean: () => q, exec: async () => value }; return q; };
test("collection token rejects stale or missing tokens but retains legacy compatibility", () => {
  assert.doesNotThrow(()=>assertCollectionToken(undefined));
  assert.doesNotThrow(()=>assertCollectionToken("new","new"));
  for(const token of [undefined,"old"])assert.throws(()=>assertCollectionToken("new",token),/collection changed/);
  assert.throws(()=>assertCollectionToken(undefined,"unexpected"),/collection changed/);
});

test("recollection archives full snapshots, changes only the ordered test and keeps audit in the transaction", async t => {
  const sample={_id:new Types.ObjectId(),billId:new Types.ObjectId(),testId:new Types.ObjectId(),patientId:new Types.ObjectId(),createdBy:new Types.ObjectId(),sampleStatus:"PROCESSED",createdAt:new Date()};
  const session={};const snapshots=[{_id:new Types.ObjectId(),parameterName:"Synthetic result",result:15,unit:"reference",referenceSnapshot:{displayValue:"synthetic"},revisions:[{result:14}]}];
  const collections: any[]=[];let invalidated=false;let audited=false;
  t.mock.method(mongoose.connection,"transaction",async(callback:any)=>callback(session));
  t.mock.method(LabSample,"findById",()=>query(sample) as any);
  t.mock.method(LabBill,"findOne",(filter:any)=>{assert.equal(filter["items.testId"],sample.testId);assert.equal(filter.patientId,sample.patientId);return query({_id:sample.billId}) as any;});
  t.mock.method(LabBill,"updateOne",(_filter:any,_update:any,options:any)=>{assert.equal(options.session,session);return query({matchedCount:1}) as any;});
  t.mock.method(LabTestResult,"find",(filter:any)=>{assert.equal(filter.testId,sample.testId);assert.equal(filter.patientId,sample.patientId);return query(snapshots) as any;});
  t.mock.method(SampleCollection,"create",async(rows:any,options:any)=>{assert.equal(options.session,session);const saved=rows.map((row:any)=>({...row,_id:new Types.ObjectId()}));collections.push(...saved);return saved;});
  t.mock.method(LabTestResult,"updateMany",(filter:any,update:any,options:any)=>{assert.equal(filter.testId,sample.testId);assert.equal(filter.billId,sample.billId);assert.equal(update.$set.superseded,true);assert.equal(options.session,session);invalidated=true;return query({matchedCount:1}) as any;});
  t.mock.method(LabSample,"findOneAndUpdate",(_filter:any,update:any,options:any)=>{assert.equal(options.session,session);assert.deepEqual(Object.keys(update.$unset).sort(),["collectedAt","processedAt","receivedAt","rejectedAt"]);return query({...sample,...update.$set}) as any;});
  t.mock.method(AuditLog,"create",async(rows:any,options:any)=>{assert.equal(options.session,session);assert.equal(rows[0].action,"sample.recollected");audited=true;return rows;});
  await assert.rejects(recollectSample(String(sample.createdBy),String(sample._id)," ",new Date()),/reason/);
  const saved=await recollectSample(String(sample.createdBy),String(sample._id),"Synthetic recollection",new Date());
  assert.equal(saved.sampleStatus,"RECOLLECTED");assert.equal(collections.length,2);assert.deepEqual(collections[0].resultSnapshots,snapshots);
  assert.equal(String(saved.activeCollectionId),String(collections[1]._id));assert.equal(invalidated,true);assert.equal(audited,true);
});

test("stale submissions and uncollected recollections cannot invoke result writes",async t=>{
  const id=new Types.ObjectId();let writes=0;let state="RECOLLECTED";
  t.mock.method(mongoose.connection,"transaction",async(callback:any)=>callback(undefined));
  t.mock.method(LabBill,"updateOne",()=>query({matchedCount:1}) as any);
  t.mock.method(LabSample,"findOne",()=>query({_id:id,activeCollectionId:id,sampleStatus:state}) as any);
  t.mock.method(LabSample,"updateOne",()=>query({matchedCount:1}) as any);
  const write=async()=>{writes++;return "saved";};
  await assert.rejects(withSampleResultWrite(String(id),String(id),undefined,write),/collection changed/);
  await assert.rejects(withSampleResultWrite(String(id),String(id),String(id),write),/Collect the new sample/);
  assert.equal(writes,0);state="COLLECTED";
  assert.equal(await withSampleResultWrite(String(id),String(id),String(id),write),"saved");assert.equal(writes,1);
});
