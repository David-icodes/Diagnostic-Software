const {chromium}=require('../backend/node_modules/playwright');
const fs=require('node:fs/promises');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
 const context=await browser.newContext();
 const api='http://localhost:5000/api/v1';
 const login=await context.request.post(api+'/auth/login',{data:{username:process.env.LIS_VERIFY_USERNAME,password:process.env.LIS_VERIFY_PASSWORD}});
 if(!login.ok()) throw new Error('Local test login failed');
 const get=async(path)=>{const response=await context.request.get(api+path);if(!response.ok())throw new Error('Read-only API failed');return (await response.json()).data};
 const bill=(await get('/lab-bills/6ac889ad77bfff99eda526ed')).bill;
 const entry=await get('/lab-test-results/bill-entry?billId='+bill.id);
 const reports=[];
 for(const item of bill.items){
  const definition=entry.tests.find(t=>t.testId===item.testId);
  if(!definition) continue;
  const results=(await get('/lab-test-results/results?billId='+bill.id+'&testId='+item.testId)).results;
  reports.push({item,results,parameters:definition.parameters.map(p=>({...p,id:p.parameterId,testId:item.testId,active:true,referenceRange:p.reference.displayValue})),resolvedReferences:Object.fromEntries(definition.parameters.map(p=>[p.parameterId,p.reference.displayValue||''])),referenceResolutions:Object.fromEntries(definition.parameters.map(p=>[p.parameterId,p.reference]))});
 }
 const data={templateName:'lab_report_ready',bill,reports,printedBy:'admin',technician:null,onlyEntered:false,printMode:'test'};
 const page=await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/api/whatsapp/lis/document-data',route=>route.fulfill({json:{success:true,data}}));
 async function render(name){
  await page.goto('http://localhost:3000/whatsapp/document?reviewId=00000000-0000-4000-8000-000000000001');
  await page.locator('[data-whatsapp-document="ready"]').waitFor();
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(Array.from(document.querySelectorAll('.lis-print-document img'),img=>img.decode()))});
  await page.emulateMedia({media:'print'});
  await page.addStyleTag({content:'@media print { html,body { background:white!important;height:auto!important;min-height:0!important; } }'});
  await page.pdf({path:'../tmp/pdfs/'+name+'.pdf',format:'A4',preferCSSPageSize:true,printBackground:true});
 }
 await render('refined-actual-report');
 data.templateName='lab_invoice_ready'; await render('refined-actual-invoice');
 data.templateName='lab_report_ready'; data.reports=[reports[0]];
 const base=reports[0].parameters[0]; if(!base) throw new Error('No parameter available for long-page fixture');
 data.reports[0]={...reports[0],parameters:Array.from({length:100},(_,i)=>({...base,id:'fixture-'+i,parameterName:'Synthetic pagination parameter '+(i+1),sortOrder:i})),results:[],resolvedReferences:{},referenceResolutions:{}};
 await render('refined-long-report-fixture');
 data.printMode='department';
 data.reports=[['MICROBIOLOGY','Synthetic first test'],['BIOCHEMISTRY','Synthetic second test'],['BIOCHEMISTRY','Synthetic third test']].map(([departmentName,testName],i)=>({...reports[0],item:{...reports[0].item,testId:'fixture-test-'+i,departmentName,testName},parameters:reports[0].parameters.slice(0,2),results:[]}));
 await render('refined-multi-department-fixture');
 await fs.writeFile('../tmp/pdfs/render-validation.json',JSON.stringify({billNumber:bill.billNumber,patientCode:bill.patientId.patientId,reportCount:reports.length,browserErrors:errors},null,2));
 console.log(JSON.stringify({reportCount:reports.length,actualDocumentsRendered:true,longFixtureRendered:true,browserErrors:errors.length}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e.message);process.exit(1)});
