import test from "node:test";
import assert from "node:assert/strict";
import { provisionMissingDevelopmentAdmin, type DevelopmentAdminStore } from "./missing-development-admin";
import { DEVELOPMENT_URI, DEVELOPMENT_DATABASE } from "./development-database-guard";

const context = { environment: "development", uri: DEVELOPMENT_URI, username: "admin", password: "synthetic-test-only", name: "Development Administrator" };
function fixture(database = DEVELOPMENT_DATABASE, owned = true, users: string[] = []) {
  const writes: unknown[] = [];
  const store: DevelopmentAdminStore = { database, hasReadyOwnership: async () => owned, usernames: async () => users, insert: async user => { writes.push(user); } };
  return { store, writes };
}
test("missing development admin is inserted once with bcrypt and normalized identity", async () => {
  const {store,writes} = fixture();
  await provisionMissingDevelopmentAdmin({...context,username:" ADMIN "},store,async()=>"$2b$synthetic-hash");
  assert.equal(writes.length,1);
  assert.deepEqual(writes[0],{username:"admin",name:context.name,role:"admin",status:"active",passwordHash:"$2b$synthetic-hash"});
});
test("existing admin, production database and unowned target fail before hashing or writes", async () => {
  for (const candidate of [fixture(DEVELOPMENT_DATABASE,true,[" ADMIN "]),fixture("diagnostic_lis"),fixture(DEVELOPMENT_DATABASE,false)]) {
    let hashes=0;
    await assert.rejects(provisionMissingDevelopmentAdmin(context,candidate.store,async()=>{hashes++;return "$2b$test";}));
    assert.equal(hashes,0);assert.equal(candidate.writes.length,0);
  }
});
test("invalid configuration or a non-bcrypt hash never writes",async()=>{
  const {store,writes}=fixture();
  await assert.rejects(provisionMissingDevelopmentAdmin({...context,password:""},store,async()=>"$2b$test"));
  await assert.rejects(provisionMissingDevelopmentAdmin(context,store,async()=>"placeholder"));
  assert.equal(writes.length,0);
});
