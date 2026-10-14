import test from "node:test";
import assert from "node:assert/strict";
process.env.MONGODB_URI="mongodb://127.0.0.1/password_tests_no_connection";
process.env.JWT_SECRET="test-only-password-session-secret";
test("vendor self-service verifies current password, stores bcrypt only and invalidates earlier sessions",async t=>{
  const {User,hashPassword,verifyPassword}=await import("../../models/user.model.js");
  const {changePassword}=await import("./auth.service.js");
  const original=await hashPassword("synthetic-current-password");let saves=0;
  const user={passwordHash:original,sessionVersion:0,save:async()=>{saves++;}};
  t.mock.method(User,"findById",async()=>user);
  await assert.rejects(changePassword("synthetic-id","wrong-current","synthetic-new-password"),/Current password/);
  assert.equal(user.passwordHash,original);assert.equal(saves,0);
  await changePassword("synthetic-id","synthetic-current-password","synthetic-new-password");
  assert.equal(await verifyPassword("synthetic-new-password",user.passwordHash),true);assert.equal(await verifyPassword("synthetic-current-password",user.passwordHash),false);
  assert.notEqual(user.passwordHash,"synthetic-new-password");assert.equal(user.sessionVersion,1);assert.equal(saves,1);
});
