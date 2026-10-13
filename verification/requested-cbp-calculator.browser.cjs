// Synthetic API interception only. No Atlas writes, patient creation, or catalogue bindings.
const {chromium}=require('../backend/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const id=n=>n.toString(16).padStart(24,'0');
(async()=>{
 const browser=await chromium.launch({headless:true});const errors=[],unexpected=[],checks=[];let saved=[],submits=0;
 try{
  const context=await browser.newContext({viewport:{width:1280,height:720}});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const patient={id:id(1),patientId:'SYN-CBP-P',fullName:'Synthetic Calculator Fixture',firstName:'Synthetic',gender:'male',age:30};
  const test={id:id(2),testCode:'SYN-CBP',testName:'Synthetic CBP Calculator',departmentId:id(3),departmentName:'Synthetic Hematology',resultMode:'PARAMETER_BASED',active:true};
  const bill={id:id(4),billNumber:'SYN-CBP-B',patientId:patient,status:'generated',netAmount:0,totalAmount:0,paidAmount:0,dueAmount:0,createdAt:new Date().toISOString(),items:[{testId:test.id,testName:test.testName,testCode:test.testCode,departmentId:test.departmentId,departmentName:test.departmentName,quantity:1,unitPrice:0,total:0}]};
  const source=(n,name,unit)=>({parameterId:id(n),parameterName:name,unit,resultType:'NUMBER',itemType:'PARAMETER',active:true,reference:{status:'NOT_CONFIGURED',source:'NONE',displayValue:''}});
  const parameters=[source(10,'Synthetic Hb','g/dL'),source(11,'Synthetic RBC','million/µL'),source(12,'Synthetic PCV','%'),source(13,'Synthetic MCH','pg'),source(14,'Synthetic MCV','fL'),source(15,'Synthetic MCHC','g/dL'),source(16,'Synthetic Manual','')];
  for(const [n,formulaId,deps,precision] of [[2,'pcv-hb-approx',[10],1],[3,'mch',[10,11],2],[4,'mcv',[12,11],2],[5,'mchc',[10,12],2]])parameters[n].calculation={formulaId,dependencyIds:deps.map(id),precision,overwrite:'CONFIRM',sourceVerification:'Explicit isolated synthetic approximation'};
  parameters.forEach((p,i)=>{p.displayOrder=i+1;p.calculationStatus=p.calculation?'APPROVED':undefined;});
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(!url.pathname.includes('/api/'))return url.hostname==='localhost'&&url.port==='3000'?route.continue():route.abort();
   const path=url.pathname.replace(/^.*\/api\/v1/,'');const ok=data=>route.fulfill({json:{success:true,data}});
   if(req.method()==='OPTIONS')return route.fulfill({status:204});
   if(req.method()==='POST'&&path==='/lab-test-results/results/submit'){submits++;saved=req.postDataJSON().entries.map(e=>({...e,id:e.parameterId,billId:bill.id,testId:test.id,patientId:patient.id,version:1}));return ok({results:saved,testId:test.id});}
   if(req.method()!=='GET'){unexpected.push(path);return route.abort();}
   if(path==='/auth/me')return ok({user:{id:id(90),username:'synthetic',name:'Synthetic Operator',role:'admin',status:'active'}});
   if(path==='/lab-bills')return ok({items:[bill],data:[bill],pagination:{total:1,page:1,limit:100,totalPages:1}});
   if(path.startsWith('/lab-bills/'))return ok({bill});
   if(path==='/lab-test-results/bill-entry')return ok({billId:bill.id,billNumber:bill.billNumber,patientId:patient.id,patientCode:patient.patientId,patientName:patient.fullName,patientGender:'male',patientAge:30,tests:[{testId:test.id,testName:test.testName,testCode:test.testCode,testLinked:true,parameters}]});
   if(path==='/lab-test-results/results')return ok({results:saved});
   if(path==='/lab-test-results/workflow')return ok({billId:bill.id,patientId:patient.id,outstandingDue:0,hasOutstandingDue:false,tests:[{testId:test.id,submitted:saved.length>0}]});
   if(path==='/lab-technicians')return ok({technicians:[]});
   if(path==='/lab-samples')return ok({data:[],pagination:{total:0,page:1,limit:100,totalPages:1}});
   unexpected.push(path);return route.abort();
  });
  const url='http://localhost:3000/laboratory/test-result/parameter-based-test-results?billId='+bill.id+'&testId='+test.id+'&billNumber='+bill.billNumber;
  await page.goto(url);const input=name=>page.getByLabel('Result for '+name,{exact:true});
  await input('Synthetic Hb').waitFor();
  assert.equal(await page.getByRole('button',{name:'Calculate Synthetic Hb',exact:true}).count(),0);
  await page.getByRole('button',{name:'Review calculation for Synthetic PCV',exact:true}).click();
  let dialog=page.getByRole('dialog');assert.match(await dialog.getByRole('alert').innerText(),/Synthetic Hb/);await dialog.getByRole('button',{name:'Cancel',exact:true}).click();checks.push('named missing inputs and manual controls');
  await input('Synthetic Hb').fill('12.1');await input('Synthetic RBC').fill('5.3');await input('Synthetic Manual').fill('77');
  for(const [name,result,display] of [['Synthetic PCV','36.3','36.3 %'],['Synthetic MCH','22.83','22.83 pg'],['Synthetic MCV','68.49','68.49 fL'],['Synthetic MCHC','33.33','33.33 g/dL']]){
   await page.getByRole('button',{name:'Review calculation for '+name,exact:true}).click();dialog=page.getByRole('dialog');assert.equal(await dialog.locator('output').innerText(),result);assert.equal(await dialog.getByLabel('Display unit').innerText(),display.slice(result.length+1));
   if(name==='Synthetic MCH'){await fs.mkdir('tmp/screenshots',{recursive:true});await page.screenshot({path:'tmp/screenshots/requested-cbp-preview-2026-10-13.png'});}
   await dialog.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await input(name).inputValue(),'');
   await page.getByRole('button',{name:'Review calculation for '+name,exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Apply Result',exact:true}).click();assert.equal(await input(name).inputValue(),result);assert.equal(submits,0);
  }checks.push('four previews, Cancel, target-only Apply and no auto-submit');
  await input('Synthetic Hb').fill('15');
  await page.getByRole('button',{name:'Review calculation for Synthetic MCH',exact:true}).click();
  const originalValues=await Promise.all(parameters.map(p=>input(p.parameterName).inputValue()));
  page.once('dialog',d=>d.dismiss());
  await page.getByRole('dialog').getByRole('button',{name:'Apply Result',exact:true}).click();
  assert.deepEqual(await Promise.all(parameters.map(p=>input(p.parameterName).inputValue())),originalValues);
  assert.equal(await page.getByRole('dialog').count(),1);
  page.once('dialog',d=>d.accept());
  await page.getByRole('dialog').getByRole('button',{name:'Apply Result',exact:true}).click();
  const acceptedValues=await Promise.all(parameters.map(p=>input(p.parameterName).inputValue()));
  assert.deepEqual(acceptedValues,originalValues.map((v,i)=>i===3?'28.3':v));
  assert.equal(submits,0);checks.push('overwrite rejection preserves all values and dialog; acceptance changes target only');
  await input('Synthetic Hb').fill('12.1');
  await page.getByRole('button',{name:'Review calculation for Synthetic MCH',exact:true}).click();
  page.once('dialog',d=>d.accept());
  await page.getByRole('dialog').getByRole('button',{name:'Apply Result',exact:true}).click();
  await input('Synthetic RBC').fill('0');await page.getByRole('button',{name:'Review calculation for Synthetic MCH',exact:true}).click();dialog=page.getByRole('dialog');assert.match(await dialog.getByRole('alert').innerText(),/zero/);assert.equal(await dialog.getByRole('button',{name:'Apply Result',exact:true}).isEnabled(),false);await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await input('Synthetic RBC').fill('5.3');checks.push('zero denominator');
  assert.equal(await input('Synthetic Manual').inputValue(),'77');await page.getByRole('button',{name:'Submit',exact:true}).click();await page.getByText(/saved for Synthetic CBP Calculator/).waitFor();assert.equal(submits,1);
  await page.reload();await input('Synthetic MCHC').waitFor();assert.equal(await input('Synthetic MCHC').inputValue(),'33.33');assert.equal(await input('Synthetic Manual').inputValue(),'77');checks.push('isolated intercepted Submit/reload preservation');
  await page.screenshot({path:'tmp/screenshots/requested-cbp-reloaded-2026-10-13.png'});
  assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,checks,databaseWrites:0,interceptedSubmits:submits}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
