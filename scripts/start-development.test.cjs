const test=require('node:test');
const assert=require('node:assert/strict');
const {healthyService}=require('./start-development.cjs');
test('reuse only a connected Diagnostic LIS backend',()=>{
  const body=JSON.stringify({success:true,message:'Diagnostic LIS API is running',database:'connected'});
  assert.equal(healthyService('backend',200,body),true);
  assert.equal(healthyService('backend',503,body),false);
  assert.equal(healthyService('backend',200,body.replace('connected','disconnected')),false);
});
test('reject unrelated services and invalid health responses',()=>{
  assert.equal(healthyService('backend',200,'other service'),false);
  assert.equal(healthyService('backend',200,'{}'),false);
  assert.equal(healthyService('frontend',200,'unrelated application'),false);
});
test('frontend reuse requires a successful Diagnostic LIS page',()=>{
  assert.equal(healthyService('frontend',200,'<title>Login | Anjali Diagnostics</title>'),true);
  assert.equal(healthyService('frontend',500,'Anjali Diagnostics'),false);
});
