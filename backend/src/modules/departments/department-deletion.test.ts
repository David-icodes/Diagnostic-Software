import test from "node:test";
import assert from "node:assert/strict";
import { Department } from "../../models/department.model";
import { LabTest } from "../../models/lab-test.model";
import { LabBill } from "../../models/lab-bill.model";
import { LabSample } from "../../models/lab-sample.model";
import { LabPackage } from "../../models/lab-package.model";
import { Doctor } from "../../models/doctor.model";
import { DoctorCommission } from "../../models/doctor-commission.model";
import { LabClientTariff } from "../../models/lab-client-tariff.model";
import { deleteDepartment } from "./department.service";
test("unreferenced deletion succeeds; historical dependencies block deletion and identify deactivation", async t => {
  let removed=0; let referenced=false;
  t.mock.method(Department,"findById",()=>({exec:async()=>({deleteOne:async()=>{removed++;}})}));
  for (const model of [LabTest,LabBill,LabSample,LabPackage,Doctor,DoctorCommission,LabClientTariff]) t.mock.method(model,"exists",async()=>model===LabBill && referenced?{_id:"historical"}:null);
  await deleteDepartment("507f1f77bcf86cd799439011");assert.equal(removed,1);
  referenced=true;await assert.rejects(deleteDepartment("507f1f77bcf86cd799439011"),/bills.*Deactivate/);assert.equal(removed,1);
});
