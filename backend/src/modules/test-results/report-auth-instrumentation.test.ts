import test from 'node:test';
import assert from 'node:assert/strict';
import {timedReportAuthentication} from './report-request-timing';
import {reportTimings} from './report-timings';

test('timed authentication retains role, inactive-account, revoked-session and missing-session checks with mocked users',async t=>{
 process.env.NODE_ENV='test';process.env.MONGODB_URI='mongodb://127.0.0.1:1/no_connection';
 process.env.JWT_SECRET='synthetic-auth-timing-test-secret';process.env.COOKIE_NAME='synthetic_session';
 const [{authenticate},{User},{signAuthToken},{requirePermission}]=await Promise.all([
  import('../../middleware/authenticate.js'),import('../../models/user.model.js'),import('../../utils/jwt.js'),import('../../middleware/require-permission.js')]);
 t.mock.method(console,'log',()=>{});
 let reads=0;let user:any;
 t.mock.method(User,'findById',async()=>{reads++;return user;});
 const run=async(role:string,status='active',version=1,missing=false)=>{
  user={role,status,sessionVersion:version,toJSON:()=>({id:'synthetic-user',role,status})};
  const req:any={method:'GET',path:'/report.pdf',originalUrl:role==='vendor'?'/api/v1/vendor-portal/bills/synthetic/report.pdf':'/api/v1/lab-test-results/report.pdf',cookies:missing?{}:{[role==='vendor'?'synthetic_session_vendor':'synthetic_session']:signAuthToken({sub:'synthetic-user',username:'synthetic',role,sessionVersion:1})}};
  const timing=reportTimings(),res:any={locals:{reportTiming:timing}};
  const error=await new Promise<any>(resolve=>{timedReportAuthentication(authenticate)(req,res,resolve);});
  assert.equal(typeof timing.stages.authentication,'number');return {error,req};
 };
 for(const role of ['admin','staff','operator','vendor']){
  const result=await run(role);assert.equal(result.error,undefined);assert.equal(result.req.user.role,role);
  const permission=await new Promise<any>(resolve=>requirePermission('test_results.view')(result.req,{} as any,resolve));
  if(role==='vendor')assert.equal(permission?.statusCode,403);else assert.equal(permission,undefined);
 }
 assert.equal((await run('admin','inactive')).error.statusCode,403);
 assert.equal((await run('admin','active',2)).error.statusCode,401);
 const before=reads;assert.equal((await run('admin','active',1,true)).error.statusCode,401);assert.equal(reads,before);
});
