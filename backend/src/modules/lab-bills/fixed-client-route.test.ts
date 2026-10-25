import test from "node:test";
import assert from "node:assert/strict";
process.env.MONGODB_URI="mongodb://127.0.0.1/fixed_client_test_no_connection";
process.env.JWT_SECRET="synthetic-fixed-client-route-secret";
test("even an administrator cannot reassign vendor ownership through Modify Bill API",async t=>{
 const [{default:app},{User},{signAuthToken}]=await Promise.all([import("../../app.js"),import("../../models/user.model.js"),import("../../utils/jwt.js")]);
 const user={id:'a'.repeat(24),username:'synthetic',name:'Synthetic',role:'admin',status:'active',sessionVersion:0,toJSON(){return this;}};t.mock.method(User,'findById',async()=>user as never);
 const server=(app as unknown as import('express').Express).listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
 const token=signAuthToken({sub:user.id,username:user.username,role:user.role,sessionVersion:0});
 const response=await fetch(`http://127.0.0.1:${(server.address() as {port:number}).port}/api/v1/lab-bills/${'b'.repeat(24)}`,{method:'PUT',headers:{cookie:`diagnostic_token=${token}`,'Content-Type':'application/json'},body:JSON.stringify({clientId:'c'.repeat(24),items:[{testId:'d'.repeat(24),quantity:1}],discountPercent:0})});assert.equal(response.status,400);
});
