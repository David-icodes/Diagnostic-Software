import test from "node:test";
import assert from "node:assert/strict";
import {assertDevelopmentDatabase, DEVELOPMENT_DATABASE, DEVELOPMENT_URI} from "./development-database-guard";
test("development initialization rejects existing databases, remote hosts and implicit configuration",()=>{
 assert.doesNotThrow(()=>assertDevelopmentDatabase("development",DEVELOPMENT_URI,DEVELOPMENT_DATABASE));
 for(const [env,uri,name] of [["production",DEVELOPMENT_URI,DEVELOPMENT_DATABASE],["development","mongodb://127.0.0.1:27017/diagnostic_lis","diagnostic_lis"],["development",undefined,undefined],["development",DEVELOPMENT_URI,"test"],["development",DEVELOPMENT_URI.replace('127.0.0.1','localhost'),DEVELOPMENT_DATABASE]]) {
  assert.throws(()=>assertDevelopmentDatabase(env,uri,name));
 }
});
