// Real MongoDB/API/browser regression. Never connects to the application's database.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
(async()=>{
 const database='lis_modify_payment_verification_'+Date.now();
 process.env.NODE_ENV='test';
 process.env.MONGODB_URI='mongodb://127.0.0.1:27029/'+database;
 process.env.JWT_SECRET=randomUUID()+randomUUID();
 process.env.FRONTEND_URL='http://localhost:3000';
 const mongoose=(await import('../backend/node_modules/mongoose/index.js')).default;
 const {chromium}=await import('../backend/node_modules/playwright/index.mjs');
 const {default:app}=await import('../backend/src/app');
 const {User,hashPassword}=await import('../backend/src/models/user.model');
 const {Patient}=await import('../backend/src/models/patient.model');
 const {Department}=await import('../backend/src/models/department.model');
 const {LabTest}=await import('../backend/src/models/lab-test.model');
 const {LabBill}=await import('../backend/src/models/lab-bill.model');
 const {LabBillPayment}=await import('../backend/src/models/lab-bill-payment.model');
 const {LabSample}=await import('../backend/src/models/lab-sample.model');
 const {LabTestResult}=await import('../backend/src/models/lab-test-result.model');
 const {AuditLog}=await import('../backend/src/models/audit-log.model');
 const {assertResultReportAllowed}=await import('../backend/src/modules/test-results/result-workflow.service');
 const checks:any[]=[];let server:any;let browser:any;
 try{
  await mongoose.connect(process.env.MONGODB_URI);
  assert.equal(mongoose.connection.host,'127.0.0.1');assert.equal(mongoose.connection.name,database);
  const password=randomUUID();const passwordHash=await hashPassword(password);
  const admin=await User.create({username:'synthetic-admin',name:'Synthetic Admin',passwordHash,role:'admin',status:'active'});
  await User.create({username:'synthetic-operator',name:'Synthetic Operator',passwordHash,role:'operator',status:'active'});
  const patient=await Patient.create({patientId:'SYNTHETIC-ONLY',firstName:'Synthetic',lastName:'Paid Bill',gender:'male',age:30,mobile:'9876543210',createdBy:admin._id});
  const department=await Department.create({name:'Synthetic Department',code:'SYNTHETIC',createdBy:admin._id});
  const test=await LabTest.create({testCode:'SYN-100',testName:'Synthetic Test',shortName:'Synthetic',departmentId:department._id,price:100,active:true,createdBy:admin._id});
  const replicaTest=await LabTest.create({testCode:'SYN-1250',testName:'Synthetic Settled Bill Test',shortName:'Settled',departmentId:department._id,price:1250,active:true,createdBy:admin._id});
  const createBill=async(name:string,paid:number,labTest:any=test,status='generated')=>{
   const total=labTest.price;
   const bill=await LabBill.create({billNumber:name,billType:'osp',patientId:patient._id,patientType:'osp',items:[{testId:labTest._id,testCode:labTest.testCode,testName:labTest.testName,departmentId:department._id,departmentName:department.name,unitPrice:total,quantity:1,total}],totalAmount:total,discountPercent:0,discountAmount:0,netAmount:total,paidAmount:paid,dueAmount:Math.max(0,total-paid),paymentMode:'cash',status,createdBy:admin._id});
   if(paid>0)await LabBillPayment.create([{billId:bill._id,amount:paid/2,paymentMode:'cash',collectedBy:admin._id,comments:'First synthetic receipt'},{billId:bill._id,amount:paid/2,paymentMode:'upi',collectedBy:admin._id,comments:'Second synthetic receipt'}]);
   await AuditLog.create({user:admin._id,action:'synthetic.initial',entityType:'LabBill',entity:bill._id});
   return bill;
  };
  const replica=await createBill('OSP202600097',1250,replicaTest);
  const baselineReplicaPayments=JSON.stringify(await LabBillPayment.find({billId:replica._id}).sort({_id:1}).lean());
  server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true});const context=await browser.newContext();
  const login=await context.request.post(origin+'/api/v1/auth/login',{data:{username:'synthetic-admin',password}});assert.equal(login.status(),200);
  const modify=async(bill:any,discountPercent=0,quantity=1,comments='Synthetic modification')=>context.request.put(origin+'/api/v1/lab-bills/'+bill._id,{data:{items:[{testId:String(bill.items[0].testId),quantity}],discountPercent,comments}});
  for(const [name,paid,discount,due,credit] of [['UNPAID',0,0,100,0],['PARTIAL',40,10,50,0],['SETTLED',100,0,0,0],['SETTLED-LOWER',100,10,0,10]] as const){
   const bill=await createBill('SYN-'+name,paid);const history=JSON.stringify(await LabBillPayment.find({billId:bill._id}).sort({_id:1}).lean());
   const response=await modify(bill,discount);assert.equal(response.status(),200,await response.text());
   const saved=await LabBill.findById(bill._id).lean();assert.equal(saved!.paidAmount,paid);assert.equal(saved!.dueAmount,due);assert.equal(Math.max(0,paid-saved!.netAmount),credit);
   assert.equal(JSON.stringify(await LabBillPayment.find({billId:bill._id}).sort({_id:1}).lean()),history);
   assert.equal(await AuditLog.countDocuments({entity:bill._id,action:'synthetic.initial'}),1);assert.equal(await AuditLog.countDocuments({entity:bill._id,action:'lab_bill.modified'}),1);
   checks.push({name,status:response.status(),paid:saved!.paidAmount,net:saved!.netAmount,due:saved!.dueAmount,credit,paymentHistoryUnchanged:true});
  }
  const settled=await LabBill.findOne({billNumber:'SYN-SETTLED'});let response=await modify(settled,0,2);assert.equal(response.status(),200);let saved=await LabBill.findById(settled!._id);assert.equal(saved!.netAmount,200);assert.equal(saved!.paidAmount,100);assert.equal(saved!.dueAmount,100);checks.push({name:'INCREASED-TOTAL',due:100,paid:100});
  for(const invalid of [{items:[]},{items:[{testId:String(test._id),quantity:0}]},{items:[{testId:String(test._id),quantity:1}],paidAmount:0},{items:[{testId:String(test._id),quantity:1}],discountPercent:101}]){const r=await context.request.put(origin+'/api/v1/lab-bills/'+settled!._id,{data:invalid});assert.equal(r.status(),400);}
  const anonymous=await browser.newContext();assert.equal((await anonymous.request.put(origin+'/api/v1/lab-bills/'+settled!._id,{data:{items:[{testId:String(test._id),quantity:1}]}})).status(),401);await anonymous.close();
  const operator=await browser.newContext();assert.equal((await operator.request.post(origin+'/api/v1/auth/login',{data:{username:'synthetic-operator',password}})).status(),200);assert.equal((await operator.request.put(origin+'/api/v1/lab-bills/'+settled!._id,{data:{items:[{testId:String(test._id),quantity:1}]}})).status(),403);await operator.close();
  const cancelled=await createBill('SYN-CANCELLED',100,test,'cancelled');assert.equal((await modify(cancelled)).status(),422);
  const pending=await LabBill.findOne({billNumber:'SYN-PARTIAL'});
  await LabTestResult.create({billId:pending!._id,patientId:patient._id,testId:test._id,parameterId:new mongoose.Types.ObjectId(),parameterName:'Synthetic parameter',resultType:'NUMERIC',result:7,enteredBy:admin._id,enteredAt:new Date(),version:1,revisions:[]});
  await assert.rejects(assertResultReportAllowed(String(pending!._id),[String(test._id)]),/outstanding due/);
  assert.equal((await assertResultReportAllowed(String(pending!._id),[String(test._id)],false)).hasOutstandingDue,true);
  const linked=await createBill('SYN-LINKED',100);linked.items.push({testId:replicaTest._id,testCode:replicaTest.testCode,testName:replicaTest.testName,departmentId:department._id,departmentName:department.name,unitPrice:1250,quantity:1,total:1250});linked.totalAmount=1350;linked.netAmount=1350;linked.dueAmount=1250;await linked.save();
  await LabSample.create({sampleId:'SYN-SAMPLE',billId:linked._id,patientId:patient._id,testId:replicaTest._id,createdBy:admin._id});assert.equal((await modify(linked)).status(),422);
  checks.push({name:'AUTH-VALIDATION-INTEGRITY',unauthenticated:401,unauthorized:403,invalidPayload:400,cancelled:422,linkedSampleRemoval:422,reportDueGuard:'preserved'});
  // Browser uses the production frontend but every API request is routed to this isolated test server.
  const ui=await browser.newContext({viewport:{width:1440,height:1000}});
  const cookie=await context.cookies(origin);await ui.addCookies(cookie.map(c=>({...c,domain:'localhost'})));
  await ui.route('**/api/**',async route=>{
   const url=new URL(route.request().url());assert.equal(url.pathname.startsWith('/api/v1/'),true,'No WhatsApp or unrelated API calls permitted');
   const response=await route.fetch({url:origin+url.pathname+url.search});await route.fulfill({response});
  });
  const page=await ui.newPage();const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:3000/laboratory/billing/modify');await page.getByLabel('Select bill OSP202600097',{exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Submit',exact:true}).isDisabled(),false);assert.equal(await page.getByText('This settled bill already has payments and cannot be modified.').count(),0);
  await page.locator('#modifyComments').fill('Synthetic paid bill saved from browser');await page.getByRole('button',{name:'Submit',exact:true}).click();await page.getByText('Bill OSP202600097 updated successfully.',{exact:true}).waitFor();
  saved=await LabBill.findById(replica._id);assert.equal(saved!.comments,'Synthetic paid bill saved from browser');assert.equal(saved!.paidAmount,1250);assert.equal(saved!.dueAmount,0);
  await page.locator('#modifyDiscountPercent').fill('10');await page.getByText(/Overpayment credit:.*125/).waitFor();const saveResponse=page.waitForResponse(r=>r.request().method()==='PUT'&&r.url().includes('/lab-bills/'));await page.getByRole('button',{name:'Submit',exact:true}).click();assert.equal((await saveResponse).status(),200);
  saved=await LabBill.findById(replica._id);assert.equal(saved!.netAmount,1125);assert.equal(saved!.paidAmount,1250);assert.equal(saved!.dueAmount,0);
  await page.reload();await page.getByLabel('Select bill OSP202600097',{exact:true}).click();await page.getByText(/Overpayment credit:.*125/).waitFor();await page.screenshot({path:'../tmp/pdfs/modify-settled-bill-credit.png'});
  assert.equal(JSON.stringify(await LabBillPayment.find({billId:replica._id}).sort({_id:1}).lean()),baselineReplicaPayments);assert.deepEqual(errors,[]);
  checks.push({name:'OSP202600097-BROWSER-SAVED',paid:1250,revisedNet:1125,due:0,overpaymentCredit:125,paymentHistoryUnchanged:true,reopenedFromMongo:true,browserErrors:errors.length});
  await writeFile('../tmp/modify-paid-bill-integration.json',JSON.stringify({isolatedLocalMongo:true,database,checks,liveWhatsAppMessages:0,productionDatabaseWrites:0},null,2));console.log('INTEGRATION PASSED '+JSON.stringify(checks));
 }finally{
  await browser?.close();if(server)await new Promise<void>(resolve=>server.close(()=>resolve()));
  if(mongoose.connection.readyState===1){assert.equal(mongoose.connection.host,'127.0.0.1');assert.equal(mongoose.connection.name,database);assert.ok(database.startsWith('lis_modify_payment_verification_'));await mongoose.connection.dropDatabase();await mongoose.disconnect();}
 }
})().catch(e=>{console.error(e.stack);process.exit(1)});
