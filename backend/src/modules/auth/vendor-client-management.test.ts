import test from 'node:test';
import assert from 'node:assert/strict';
import {Types} from 'mongoose';
import {LabClient} from '../../models/lab-client.model';
import {User,verifyPassword} from '../../models/user.model';
import {AuditLog} from '../../models/audit-log.model';
import {configureVendorCredentials,deactivateVendorClient} from './vendor-client-management.service';
const q=(value:unknown)=>({exec:async()=>value});
test('client without account requires explicit initial password; creation is hashed, client scoped and duplicate safe',async t=>{
 const id=new Types.ObjectId(),actor={id:String(new Types.ObjectId()),role:'admin'};let active=true,created:any,calls=0;
 t.mock.method(LabClient,'findById',()=>q({_id:id,name:'Synthetic Clinic',active}) as any);
 t.mock.method(User,'findOne',()=>q(null) as any);t.mock.method(User,'exists',async()=>null);
 t.mock.method(User,'create',async(value:any)=>{calls++;created={...value,_id:new Types.ObjectId()};return created;});
 t.mock.method(AuditLog,'create',async(value:any)=>{assert.equal(JSON.stringify(value).includes('fixture-password'),false);return {} as any;});
 await assert.rejects(configureVendorCredentials(String(id),actor,{username:'Synthetic Clinic',password:''}),/initial password/);assert.equal(calls,0);
 const result=await configureVendorCredentials(String(id),actor,{username:'Synthetic Clinic',password:'fixture-password'});
 assert.equal(result.username,'synthetic clinic');assert.equal(created.clientId,id);assert.equal(created.role,'vendor');assert.equal(created.status,'active');assert.equal(await verifyPassword('fixture-password',created.passwordHash),true);assert.equal('passwordHash' in result,false);
 active=false;await assert.rejects(configureVendorCredentials(String(id),actor,{username:'Synthetic Clinic',password:'fixture-password'}),/Activate the client/);assert.equal(calls,1);
});
test('authorization and malformed IDs deny before repository calls; delete disables only owned vendor accounts and retains client',async t=>{
 const id=new Types.ObjectId(),actor={id:String(new Types.ObjectId()),role:'admin'};let reads=0,saves=0;const updates:any[]=[];
 const client:any={_id:id,name:'Synthetic',active:true,set:()=>{},save:async()=>{saves++;}};
 t.mock.method(LabClient,'findById',()=>{reads++;return q(client) as any;});
 t.mock.method(User,'updateMany',(filter:any,update:any)=>{updates.push({filter,update});return q({}) as any;});
 t.mock.method(AuditLog,'create',async()=>({}) as any);
 for(const role of ['staff','operator','vendor','']){
  await assert.rejects(configureVendorCredentials(String(id),{...actor,role},{username:'synthetic',password:'fixture-password'}),/Administrator/);
  await assert.rejects(deactivateVendorClient(String(id),{...actor,role}),/Administrator/);
 }
 await assert.rejects(deactivateVendorClient('bad',actor),/not found/);assert.equal(reads,0);assert.equal(saves,0);
 await deactivateVendorClient(String(id),actor);assert.equal(client.active,false);assert.equal(saves,1);assert.deepEqual(updates,[{filter:{clientId:id,role:'vendor'},update:{$set:{status:'inactive'},$inc:{sessionVersion:1}}}]);assert.equal(client._id,id);
});
