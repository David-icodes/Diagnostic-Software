import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {reportTimings} from './report-timings';
import {reportRequestTiming,timedReportAuthentication} from './report-request-timing';

test('success, authentication failure and disconnect log one safe correlated completion',async t=>{
 const logs:string[]=[];t.mock.method(console,'info',(...args:unknown[])=>{logs.push(args.join(' '));});
 for(const scenario of ['success','denied','disconnect']){
  const res:any=new EventEmitter();const headers:Record<string,unknown>={};
  Object.assign(res,{locals:{},statusCode:scenario==='denied'?401:200,writableFinished:scenario!=='disconnect',setHeader:(k:string,v:unknown)=>{headers[k]=v;},getHeader:(k:string)=>headers[k]});
  const req:any={method:'GET',path:'/lab-test-results/report.pdf',body:{private:'not logged'},cookies:{secret:'not logged'}};
  let passed=0;reportRequestTiming(req,res,()=>{passed++;});assert.equal(passed,1);
  const correlation=headers['X-Report-Request-Id'];reportRequestTiming(req,res,()=>{});
  assert.equal(headers['X-Report-Request-Id'],correlation);
  await timedReportAuthentication((_req,_res,next)=>{next(scenario==='denied'?Error('private error excluded'):undefined);})(req,res,()=>{});
  res.emit(scenario==='disconnect'?'close':'finish');res.emit('close');
  const entry=JSON.parse(logs.at(-1)!.replace('[report-timing] ',''));
  assert.equal(entry.requestId,headers['X-Report-Request-Id']);assert.equal(entry.completed,scenario!=='disconnect');
  assert.equal(entry.status,res.statusCode);assert.equal(typeof entry.stages.authentication,'number');
  assert.ok(!logs.at(-1)!.includes('private'));assert.ok(!logs.at(-1)!.includes('secret'));
  assert.deepEqual(Object.keys(entry).sort(),['bytes','cache','completed','requestId','stages','status','totalMs'].sort());
 }
 assert.equal(logs.length,3);
});

test('non-report requests remain unchanged and repeated authentication durations accumulate',async()=>{
 const res:any={locals:{}};let next=0;reportRequestTiming({method:'GET',path:'/patients'} as any,res,()=>{next++;});
 assert.equal(next,1);assert.deepEqual(res.locals,{});
 let clock=0;const timing=reportTimings(()=>clock);
 clock=3;timing.mark('authentication',0);clock=8;timing.mark('authentication',3);
 assert.equal(timing.stages.authentication,8);
});
