import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes";
import dashboardRoutes from "../modules/dashboard/dashboard.routes";
import patientRoutes from "../modules/patients/patient.routes";
import departmentRoutes from "../modules/departments/department.routes";
import labTestRoutes from "../modules/lab-tests/lab-test.routes";
import doctorRoutes from "../modules/doctors/doctor.routes";
import labBillRoutes from "../modules/lab-bills/lab-bill.routes";
import labClientRoutes from "../modules/lab-clients/lab-client.routes";
import labSampleRoutes from "../modules/lab-samples/lab-sample.routes";
import testResultRoutes from "../modules/test-results/test-result.routes";
import labTechnicianRoutes from "../modules/lab-technicians/lab-technician.routes";
import reportRoutes from "../modules/reports/routes/reports.routes";
import databaseOptionsRoutes from "../modules/database-options/database-options.routes";
import doctorSpecialisationRoutes from "../modules/doctor-specialisations/doctor-specialisation.routes";
import doctorDesignationRoutes from "../modules/doctor-designations/doctor-designation.routes";
import locationRoutes from "../modules/locations/location.routes";
import packageRoutes from "../modules/packages/package.routes";
import labTariffRoutes from "../modules/lab-tariffs/lab-tariff.routes";
import labTestParameterRoutes from "../modules/lab-test-parameters/lab-test-parameter.routes";
import commissionMappingRoutes from "../modules/commission-mappings/commission-mapping.routes";
import clientTariffRoutes from "../modules/client-tariffs/client-tariff.routes";

const router = Router();

router.get("/health", (_req, res) => {
  return res.json({ success: true, message: "Diagnostic LIS API is running" });
});

router.use("/auth", authRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/patients", patientRoutes);
router.use("/departments", departmentRoutes);
router.use("/lab-tests", labTestRoutes);
router.use("/doctors", doctorRoutes);
router.use("/lab-bills", labBillRoutes);
router.use("/lab-clients", labClientRoutes);
router.use("/lab-samples", labSampleRoutes);
router.use("/lab-test-results", testResultRoutes);
router.use("/lab-technicians", labTechnicianRoutes);
router.use("/reports", reportRoutes);
router.use("/database", databaseOptionsRoutes);
router.use("/database/doctor-specialisations", doctorSpecialisationRoutes);
router.use("/database/doctor-designations", doctorDesignationRoutes);
router.use("/database/locations", locationRoutes);
router.use("/database/packages", packageRoutes);
router.use("/lab-tariffs", labTariffRoutes);
router.use("/lab-test-parameters", labTestParameterRoutes);
router.use("/commission-mappings", commissionMappingRoutes);
router.use("/client-tariffs", clientTariffRoutes);

export default router;