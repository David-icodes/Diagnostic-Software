import test from "node:test";
import assert from "node:assert/strict";
process.env.MONGODB_URI="mongodb://127.0.0.1/vendor_foundation_no_connection";
process.env.JWT_SECRET="synthetic-vendor-foundation-secret";
test("dedicated vendor login uses exact client identity, rejects inactive/wrong credentials and signs existing session",async t=>{
 const [{LabClient},{User,hashPassword},{authenticateVendor}]=await Promise.all([import("../../models/lab-client.model.js"),import("../../models/user.model.js"),import("./vendor-login.service.js")]);
 const clientId="507f1f77bcf86cd799439011";let active=true;let exists=true;
 t.mock.method(LabClient,"findOne",(query:any)=>({exec:async()=>query.clientCode==="SYN-VC"&&query.name==="Synthetic Client"&&active?{_id:clientId}:null}) as any);
 const passwordHash=await hashPassword("synthetic-password");
 t.mock.method(User,"findOne",(query:any)=>{assert.equal(query.role,"vendor");assert.equal(query.status,"active");assert.equal(String(query.clientId),clientId);return {exec:async()=>exists?{id:"507f1f77bcf86cd799439012",username:"synthetic",role:"vendor",passwordHash,sessionVersion:2,toJSON:()=>({role:"vendor",clientId})}:null} as any;});
 const result=await authenticateVendor(" SYN-VC ","Synthetic Client","synthetic-password");assert.equal(result.user.role,"vendor");assert.ok(result.token);assert.equal("passwordHash" in result.user,false);
 await assert.rejects(authenticateVendor("SYN-VC","Other Client","synthetic-password"),/Invalid vendor/);
 await assert.rejects(authenticateVendor("SYN-VC","Synthetic Client","wrong-password"),/Invalid vendor/);
 active=false;await assert.rejects(authenticateVendor("SYN-VC","Synthetic Client","synthetic-password"),/Invalid vendor/);active=true;exists=false;await assert.rejects(authenticateVendor("SYN-VC","Synthetic Client","synthetic-password"),/Invalid vendor/);
});
test("shared login accepts active vendors with active client ownership and preserves administrator login",async t=>{
 const {User,hashPassword}=await import("../../models/user.model.js");const {LabClient}=await import("../../models/lab-client.model.js");const {authenticateUser}=await import("./auth.service.js");
 const user={id:"507f1f77bcf86cd799439015",username:"synthetic-login",clientId:"507f1f77bcf86cd799439011" as string|undefined,role:"vendor",status:"active",passwordHash:await hashPassword("synthetic-password"),sessionVersion:0,toJSON(){return {id:this.id,role:this.role};}};
 let activeClient=true;
 t.mock.method(User,"findOne",async()=>user as any);
 t.mock.method(LabClient,"exists",async(query:any)=>{assert.equal(String(query._id),user.clientId);return activeClient?{_id:user.clientId}:null;});
 assert.equal((await authenticateUser("SYNTHETIC-LOGIN","synthetic-password")).user.role,"vendor");
 await assert.rejects(authenticateUser("synthetic-login","wrong"),/Invalid username/);
 activeClient=false;await assert.rejects(authenticateUser("synthetic-login","synthetic-password"),/Client account is unavailable/);
 user.clientId=undefined;await assert.rejects(authenticateUser("synthetic-login","synthetic-password"),/Client account is unavailable/);
 user.status="inactive";await assert.rejects(authenticateUser("synthetic-login","synthetic-password"),/not active/);
 user.status="active";user.role="admin";assert.equal((await authenticateUser("synthetic-login","synthetic-password")).user.role,"admin");
});
