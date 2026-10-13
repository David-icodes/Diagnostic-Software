// Deliberately does not load .env or offer reset/drop operations.
import mongoose from "mongoose";
import {readdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {assertDevelopmentDatabase, DEVELOPMENT_DATABASE, DEVELOPMENT_URI} from "../utils/development-database-guard";
import {Department} from "../models/department.model";
import {LabTest} from "../models/lab-test.model";
import {LabTestParameter} from "../models/lab-test-parameter.model";

async function main() {
 assertDevelopmentDatabase(process.env.NODE_ENV,process.env.LIS_DEVELOPMENT_URI);
 await mongoose.connect(DEVELOPMENT_URI,{autoIndex:false,autoCreate:false,serverSelectionTimeoutMS:5000});
 try {
  assertDevelopmentDatabase(process.env.NODE_ENV,process.env.LIS_DEVELOPMENT_URI,mongoose.connection.name);
  const db=mongoose.connection.db!;
  // Refuse even an owned database on rerun: review it, never silently reseed it.
  const existing=await db.listCollections().toArray();
  if(existing.length) {
   const owned=await db.collection('_development_ownership').findOne({purpose:"isolated LIS development",database:DEVELOPMENT_DATABASE,schemaVersion:1,status:"INITIALIZING"});
   if(!process.argv.includes('--resume-empty-owned')||!owned) throw new Error("Target is not empty; initialization refused without altering any collection");
   for(const c of existing) if(c.name!=='_development_ownership'&&await db.collection(c.name).countDocuments()) throw new Error("Target is not empty; initialization refused without altering any collection");
  } else await db.collection("_development_ownership").insertOne({purpose:"isolated LIS development",database:DEVELOPMENT_DATABASE,createdAt:new Date(),schemaVersion:1,status:"INITIALIZING"});
  const modelDir=path.resolve(__dirname,"../models");
  for(const file of await readdir(modelDir)) if(file.endsWith('.model.ts')||file.endsWith('.model.js')) await import(pathToFileURL(path.join(modelDir,file)).href);
  for(const model of Object.values(mongoose.models)) {await model.createCollection();await model.createIndexes();}
  const actor=new mongoose.Types.ObjectId(); // Synthetic attribution; no copied user or login credentials.
  const department=await Department.create({name:"Development Catalogue Review",code:"DEVREV",createdBy:actor});
  const catalogue=JSON.parse(await readFile(path.resolve(__dirname,"../../../reports/cbc-profile-records-2026-10-12.json"),"utf8"));
  if(catalogue.readOnly!==true||catalogue.source!=='Fresh catalogue read'||catalogue.database!=='diagnostic_lis') throw new Error("Expected verified read-only catalogue inventory");
  let parameters=0;
  for(const entry of catalogue.inventory) {
   await LabTest.create({_id:entry.test._id,testCode:entry.test.testCode,testName:entry.test.testName,shortName:entry.test.testCode,departmentId:department._id,price:0,active:false,resultMode:"PARAMETER_BASED",createdBy:actor,description:"Development review copy; clinical mappings remain unapproved"});
   for(const source of entry.parameters) {
    // Explicit allowlist: no arbitrary production fields, bindings or actor IDs.
    const row:Record<string,unknown>={_id:source._id,testId:source.testId,createdBy:actor,active:false};
    for(const key of ['parameterName','unit','resultType','itemType','method','referenceRange','subtitle','displayOrder']) if(source[key]!==undefined) row[key]=source[key];
    await LabTestParameter.create(row);parameters++;
   }
  }
  const profile=await LabTest.create({testCode:"SYN-CBC-DEV",testName:"Synthetic Development CBC",shortName:"SYN CBC",departmentId:department._id,price:0,active:true,resultMode:"PARAMETER_BASED",createdBy:actor});
  for(const [i,name,unit] of [[1,'Synthetic Hb','g/dL'],[2,'Synthetic RBC','million/µL'],[3,'Synthetic MCH','pg']] as const) await LabTestParameter.create({testId:profile._id,parameterName:name,unit,resultType:"NUMBER",displayOrder:i,active:true,createdBy:actor});
  // Synthetic profile starts unapproved; executable acceptance is tested through the authenticated API fixture.
  await db.collection('_development_ownership').updateOne({database:DEVELOPMENT_DATABASE},{$set:{status:"READY",catalogueSource:catalogue.generatedAt}});
  const collections=[];
  for(const c of await db.listCollections().toArray()) collections.push({name:c.name,count:await db.collection(c.name).countDocuments(),indexes:(await db.collection(c.name).indexes()).map(x=>x.name)});
  const report={database:DEVELOPMENT_DATABASE,loopback:true,liveConfigurationChanged:false,profiles:catalogue.inventory.length,reviewParameters:parameters,syntheticProfiles:1,syntheticParameters:3,approvedBindings:0,collections,validation:"Existing Mongoose model validation and indexes; no additional MongoDB validators invented",createdAt:new Date().toISOString()};
  await writeFile(path.resolve(__dirname,"../../../reports/development-database-2026-10-12.json"),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({database:DEVELOPMENT_DATABASE,reviewParameters:parameters,collections:collections.length,approvedBindings:0}));
 } finally {await mongoose.disconnect();}
}
main().catch(error=>{console.error(JSON.stringify({initializationFailed:true,error:error.name,message:error.message.includes('Target is not empty')?error.message:'Initialization failed; inspect development state before retrying'}));process.exitCode=1;});
