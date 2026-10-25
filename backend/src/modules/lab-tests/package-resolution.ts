import { Types } from "mongoose";
import { LabPackage } from "../../models/lab-package.model";
import { LabTest } from "../../models/lab-test.model";
import { Department } from "../../models/department.model";
import { ApiError } from "../../utils/api-error";

/** Resolve authoritative catalogue records, not populated-object shapes in the browser. No writes. */
export async function resolveBillingPackage(id:string) {
  if(!Types.ObjectId.isValid(id))throw new ApiError(400,"Invalid package identifier");
  const pack=await LabPackage.findOne({_id:id,active:{$ne:false}}).exec();
  if(!pack?.items.length)throw new ApiError(422,"This package has no active configured investigations.");
  const ids=pack.items.map(row=>String(row.testId));
  if(new Set(ids).size!==ids.length)throw new ApiError(422,"The package repeats an investigation; correct the duplicate mapping.");
  const tests=await LabTest.find({_id:{$in:ids}}).exec();
  const departments=await Department.find({_id:{$in:tests.map(test=>test.departmentId)}}).exec();
  const members=ids.map(id=>{
    const test=tests.find(row=>String(row._id)===id);
    if(!test)throw new ApiError(422,`Package investigation ${id} is missing.`);
    const department=departments.find(row=>String(row._id)===String(test.departmentId));
    if(!department)throw new ApiError(422,`The department for package investigation ${test.testName} is missing.`);
    return {testId:id,testName:test.testName,departmentId:String(department._id),departmentName:department.name};
  });
  return {id:String(pack._id),name:pack.name,amount:pack.amount,members};
}
