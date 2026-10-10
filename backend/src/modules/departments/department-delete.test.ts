import test from "node:test";
import assert from "node:assert/strict";
import { deleteDepartment } from "./department.service";
import { Department } from "../../models/department.model";
import { LabTest } from "../../models/lab-test.model";
import { LabBill } from "../../models/lab-bill.model";
import { LabSample } from "../../models/lab-sample.model";
import { LabPackage } from "../../models/lab-package.model";
import { Doctor } from "../../models/doctor.model";
import { DoctorCommission } from "../../models/doctor-commission.model";
import { LabClientTariff } from "../../models/lab-client-tariff.model";
const id = "507f1f77bcf86cd799439011";
test("department deletion checks every reference and preserves referenced records", async (t) => {
  let deleted = 0;
  t.mock.method(Department, "findById", () => ({ exec: async () => ({ deleteOne: async () => { deleted++; } }) }));
  const sources = [LabTest, LabBill, LabSample, LabPackage, Doctor, DoctorCommission, LabClientTariff];
  let referenced = -1;
  sources.forEach((source,index) => t.mock.method(source, "exists", async () => index === referenced ? { _id: id } : null));
  for (let i=0; i<sources.length; i++) { referenced=i; await assert.rejects(deleteDepartment(id), /Cannot delete/); }
  assert.equal(deleted,0); referenced=-1; await deleteDepartment(id); assert.equal(deleted,1);
  await assert.rejects(deleteDepartment("invalid"), /Invalid department/);
});
