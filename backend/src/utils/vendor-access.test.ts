import test from "node:test";
import assert from "node:assert/strict";
import { vendorRouteAllowed, vendorClientId } from "./vendor-access";
import { roleHasPermission } from "../middleware/require-permission";
test("vendor routes fail closed for administrative modules, results, exports and direct API access", () => {
  for (const path of ["/api/v1/dashboard/summary","/api/v1/patients","/api/v1/lab-bills/id","/api/v1/auth/vendor-users","/api/whatsapp/lis/send","/api/v1/vendor-portal-other","/api/v1/reports/download"]) assert.equal(vendorRouteAllowed("vendor",path),false);
  for (const path of ["/api/v1/vendor-portal/bills","/api/v1/auth/me","/api/v1/auth/change-password"]) assert.equal(vendorRouteAllowed("vendor",path),true);
  assert.equal(vendorRouteAllowed("admin","/api/v1/dashboard/summary"),true);
  assert.equal(roleHasPermission("vendor","billing.modify"),false); assert.equal(roleHasPermission("vendor","test_results.enter"),false);
});
test("vendor scope requires stable configured client ID; names are not identities", () => {
  const user={id:"user",username:"vendor",name:"Synthetic",role:"vendor" as const,status:"active" as const,clientId:"507f1f77bcf86cd799439011"};
  assert.equal(vendorClientId(user),user.clientId);
  assert.throws(()=>vendorClientId({...user,clientId:undefined}),/assignment/);
  assert.throws(()=>vendorClientId({...user,clientId:"display name"}),/assignment/);
});


test("an assigned hydrated vendor account retains scope through authentication serialization", async()=>{
 const {User}=await import('../models/user.model.js');
 const clientId='507f1f77bcf86cd799439011';
 const account=new User({username:'synthetic-vendor',name:'Synthetic',role:'vendor',status:'active',clientId});
 assert.equal(vendorClientId(account.toJSON() as never),clientId);
 assert.throws(()=>vendorClientId({...account.toJSON(),role:'admin'} as never),/Sign in with a Vendor Client account/);
});
