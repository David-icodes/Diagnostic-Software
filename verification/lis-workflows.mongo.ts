/** Runs only against a fresh, uniquely named localhost MongoDB database. */
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mongoose from "../backend/node_modules/mongoose";
import { LabClient } from "../backend/src/models/lab-client.model";
import { LabClientTariff } from "../backend/src/models/lab-client-tariff.model";
import { Counter } from "../backend/src/models/counter.model";
import { createClient } from "../backend/src/modules/lab-clients/lab-client.service";
import { applyClientTariffs,listClientTariffs } from "../backend/src/modules/client-tariffs/client-tariff.service";
import { buildSnapshotItems } from "../backend/src/modules/lab-bills/lab-bill.service";
import { Department } from "../backend/src/models/department.model";
import { LabTest } from "../backend/src/models/lab-test.model";
import { LabTestParameter } from "../backend/src/models/lab-test-parameter.model";
import { Patient } from "../backend/src/models/patient.model";
import { LabBill } from "../backend/src/models/lab-bill.model";
import { LabSample } from "../backend/src/models/lab-sample.model";
import { LabTestResult } from "../backend/src/models/lab-test-result.model";
import { SpecimenOption } from "../backend/src/models/specimen-option.model";
import { AuditLog } from "../backend/src/models/audit-log.model";
import { createSpecimenOption, listTestSpecimenOptions, createTest, listTests } from "../backend/src/modules/lab-tests/lab-test.service";
import { createParameter, getParameter, updateParameter } from "../backend/src/modules/lab-test-parameters/lab-test-parameter.service";
import { updateLabSampleStatus, listLabSamples } from "../backend/src/modules/lab-samples/lab-sample.service";
import { submitTestResults, getBillResultEntry } from "../backend/src/modules/test-results/test-result.service";
import { assertBillDocumentAllowed, assertResultReportAllowed } from "../backend/src/modules/test-results/result-workflow.service";

const database = "diagnostic_lis_verification_" + randomUUID().replaceAll("-", "");
test("real MongoDB LIS creation, configuration, collection, formula revisions and due restrictions", async () => {
 assert.match(database,/^diagnostic_lis_verification_[a-f0-9]{32}$/);
 await mongoose.connect("mongodb://127.0.0.1:27017/"+database,{serverSelectionTimeoutMS:5000,autoCreate:false,autoIndex:false});
 try {
  assert.equal(mongoose.connection.name,database);assert.equal((await mongoose.connection.db!.listCollections().toArray()).length,0);
  const models=[Department,LabTest,LabTestParameter,Patient,LabBill,LabSample,LabTestResult,SpecimenOption,AuditLog,LabClient,LabClientTariff,Counter];
  for(const model of models){await model.createCollection();await model.createIndexes();}
  const userId=new mongoose.Types.ObjectId();const user=String(userId);
  const department=await Department.create({name:"Synthetic Department",code:"SYNTHETIC",createdBy:userId});
  await createSpecimenOption(user,{kind:"sample",name:"Synthetic EDTA"});await createSpecimenOption(user,{kind:"tube",name:"Synthetic Tube"});await createSpecimenOption(user,{kind:"sample",name:"synthetic edta"});
  assert.equal(await SpecimenOption.countDocuments(),2);assert.ok((await listTestSpecimenOptions()).sampleTypes.includes("Synthetic EDTA"));
  const labTest=await createTest(user,{testCode:"INVG202",testName:"Synthetic CBC",shortName:"CBC",departmentId:department._id,sampleType:"Synthetic EDTA",containerType:"Synthetic Tube",price:100,active:true,resultMode:"PARAMETER_BASED"});
  const testId=String((labTest as any)._id);assert.equal((await listTests({departmentId:String(department._id),page:1,limit:100})).items[0].id,testId);
  await assert.rejects(createTest(user,{...labTest.toObject(),testName:"Synthetic Duplicate",_id:undefined} as never),/already exists/);
  const client=await createClient(user,{name:"Synthetic Client",city:"Synthetic City",active:true});
  await assert.rejects(createClient(user,{name:"Synthetic Client",active:true}),/already exists/);
  await assert.rejects(buildSnapshotItems([{testId,quantity:1}],"osp",[],String(client._id)),/client-specific tariff/);
  await applyClientTariffs(user,{clientId:String(client._id),departmentId:String(department._id),rows:[{testId,price:73}],overwrite:false});
  assert.equal((await listClientTariffs(String(client._id),String(department._id))).data[0].clientPrice,73);
  const priced=await buildSnapshotItems([{testId,quantity:2}],"osp",[],String(client._id));assert.equal(priced[0].unitPrice,73);assert.equal(priced[0].total,146);assert.equal((await buildSnapshotItems([{testId,quantity:1}],"osp"))[0].unitPrice,100);
  const base={testId:labTest._id,active:true,referenceType:"GENERAL",referenceMappings:[],mappingTypes:[],genderRanges:[],resultType:"NUMBER"};
  const heading=await createParameter(user,{...base,itemType:"SUBTITLE",parameterName:"Synthetic Indices",displayOrder:1} as never);
  const rbc=await createParameter(user,{...base,parameterName:"Synthetic RBC",unit:"million/µL",displayOrder:2} as never);
  const mcv=await createParameter(user,{...base,parameterName:"Synthetic MCV",unit:"fL",displayOrder:3} as never);
  const pcv=await createParameter(user,{...base,parameterName:"Synthetic PCV",unit:"%",displayOrder:4,calculationApproved:true,calculation:{formulaId:"pcv",dependencyIds:[String(rbc._id),String(mcv._id)]}} as never);
  await assert.rejects(createParameter(user,{...base,parameterName:"Unapproved MCH",unit:"pg",calculation:{formulaId:"mch",dependencyIds:[String(rbc._id),String(mcv._id)]}} as never),/Laboratory approval/);
  assert.equal(await LabTestParameter.countDocuments({parameterName:"Unapproved MCH"}),0);
  const hb=await createParameter(user,{...base,parameterName:"Synthetic Hb",displayOrder:6,unit:"g/dL"} as never);
  const mch=await createParameter(user,{...base,parameterName:"Synthetic MCH",displayOrder:7,unit:"pg",calculationApproved:true,calculation:{formulaId:"mch",dependencyIds:[String(hb._id),String(rbc._id)],precision:2}} as never);
  const calculatedMcv=await createParameter(user,{...base,parameterName:"Synthetic Calculated MCV",displayOrder:8,unit:"fL",calculationApproved:true,calculation:{formulaId:"mcv",dependencyIds:[String(pcv._id),String(rbc._id)],precision:2}} as never);
  await updateParameter(String(mch._id),user,{calculation:{formulaId:"mch",dependencyIds:[String(hb._id),String(rbc._id)],precision:2}});
  assert.equal(await LabTestParameter.countDocuments({parameterName:"Synthetic MCH"}),1);
  await assert.rejects(updateParameter(String(mch._id),user,{calculation:{formulaId:"mch",dependencyIds:[String(hb._id),String(rbc._id)],precision:3}}),/Laboratory approval/);
  await assert.rejects(updateParameter(String(mcv._id),user,{calculationApproved:true,calculation:{formulaId:"mcv",dependencyIds:[String(pcv._id),String(rbc._id)]}}),/Circular/);
  assert.ok((await getParameter(String(calculatedMcv._id))).calculation);
  const narrative=await createParameter(user,{...base,itemType:"TEXT_AREA",parameterName:"Synthetic Comment",displayOrder:5,defaultValue:"Configured text\nSecond line"} as never);
  assert.equal((await getParameter(String(heading._id))).itemType,"SUBTITLE");assert.equal((await getParameter(String(narrative._id))).defaultValue,"Configured text\nSecond line");assert.deepEqual((await getParameter(String(pcv._id))).calculation?.dependencyIds,[String(rbc._id),String(mcv._id)]);
  const patient=await Patient.create({patientId:"SYNTHETIC-P001",firstName:"Synthetic",fullName:"Synthetic Patient",gender:"male",age:30,mobile:"0000000000",createdBy:userId});
  const bill=await LabBill.create({billNumber:"SYNTHETIC-B001",patientId:patient._id,items:[{testId:labTest._id,testCode:"INVG202",testName:"Synthetic CBC",departmentId:department._id,departmentName:department.name,unitPrice:100,quantity:1,total:100}],totalAmount:100,netAmount:100,paidAmount:0,dueAmount:100,status:"generated",createdBy:userId});
  const billId=String(bill._id);const sample=await LabSample.create({sampleId:"SYNTHETIC-S001",billId:bill._id,patientId:patient._id,testId:labTest._id,departmentId:department._id,createdBy:userId});
  for(const status of ["COLLECTED","REJECTED","RECOLLECTED","COLLECTED","RECEIVED","PROCESSED"] as const){const updated=await updateLabSampleStatus(user,String(sample._id),{status,time:"10:30",comments:"Synthetic "+status});assert.equal(updated.sampleStatus,status);assert.equal((await LabSample.findById(sample._id))?.sampleStatus,status);}
  assert.equal((await LabSample.findById(sample._id))?.history[1].comments,"Synthetic REJECTED");assert.equal((await LabSample.findById(sample._id))?.history.length,6);
  const listed=await listLabSamples({mode:"criteria",billNumber:"SYNTHETIC-B001",page:1,limit:100,userId:user});assert.equal(listed.data[0].sampleStatus,"PROCESSED");assert.equal(await LabSample.countDocuments(),1);
  const input={billId,testId,entries:[{parameterId:String(rbc._id),result:4},{parameterId:String(mcv._id),result:90},{parameterId:String(pcv._id),result:999},{parameterId:String(hb._id),result:12},{parameterId:String(narrative._id),result:"Synthetic report\nSecond line"}]};
  await submitTestResults(user,input);assert.equal((await LabTestResult.findOne({parameterId:pcv._id}))?.result,36);
  assert.equal((await LabTestResult.findOne({parameterId:mch._id}))?.result,30);
  assert.equal((await LabTestResult.findOne({parameterId:calculatedMcv._id}))?.result,90);
  input.entries[0].result=5;await submitTestResults(user,input);const revised=await LabTestResult.findOne({parameterId:pcv._id});assert.equal(revised?.result,45);assert.equal(revised?.revisions[0].result,36);assert.equal(revised?.version,2);assert.equal(revised?.calculationSnapshot?.formulaId,"pcv");assert.equal(revised?.calculationSnapshot?.inputs[0].value,5);assert.equal(revised?.revisions[0].calculationSnapshot?.inputs[0].value,4);assert.equal(await AuditLog.countDocuments({action:"lab.calculation_configured"}),3);
  await assert.rejects(updateParameter(String(pcv._id),user,{itemType:"SUBTITLE"}),/recorded results/);
  const entry=await getBillResultEntry(billId);assert.equal(entry.tests[0].parameters[0].itemType,"SUBTITLE");assert.equal(entry.tests[0].parameters[4].itemType,"TEXT_AREA");
  await assert.rejects(assertBillDocumentAllowed(billId),/outstanding due/);await assert.rejects(assertResultReportAllowed(billId,[testId],false),/outstanding due/);
  assert.equal((await LabBill.findById(bill._id))?.paidAmount,0);assert.equal((await LabBill.findById(bill._id))?.dueAmount,100);
  // Settle only this synthetic fixture in the new database to verify release eligibility.
  bill.paidAmount=100;bill.dueAmount=0;await bill.save();assert.equal((await assertBillDocumentAllowed(billId)).outstandingDue,0);assert.equal((await assertResultReportAllowed(billId,[testId])).outstandingDue,0);
  assert.equal(await AuditLog.countDocuments({action:"sample.status_updated"}),6);
  const concurrent = await Promise.allSettled([updateLabSampleStatus(user,String(sample._id),{status:"RECOLLECTED"}),updateLabSampleStatus(user,String(sample._id),{status:"RECOLLECTED"})]);
  assert.equal(concurrent.filter(result=>result.status==="fulfilled").length,1);assert.equal(concurrent.filter(result=>result.status==="rejected").length,1);assert.equal((await LabSample.findById(sample._id))?.history.length,7);
 } finally {
  assert.equal(mongoose.connection.name,database);assert.match(database,/^diagnostic_lis_verification_[a-f0-9]{32}$/);
  await mongoose.connection.dropDatabase();await mongoose.disconnect();
 }
});
