import "dotenv/config";
import { connectDB } from "../config/db";
import { Patient } from "../models/patient.model";

/**
 * Demo patient seeding is disabled.
 *
 * These five registrations (mobiles 9876500001-9876500005) were demo fixtures
 * created only for trial runs. They have been archived and removed from the OSP
 * Patient Registration Report, and this script no longer re-creates them so the
 * report cannot fill up with demo data again.
 *
 * Real registrations always come from the application itself
 * (POST /api/v1/patients) and are never affected by this script.
 *
 * The archived rows stay in the database with `status: "inactive"` because they
 * are referenced by seeded bills, samples and test results; that history is
 * preserved on purpose. Re-activate one with
 * PUT /api/v1/patients/:id {"status":"active"} if it is ever needed again.
 */
async function demoPatientsSeedingDisabled(): Promise<void> {
  await connectDB();

  const remaining = await Patient.find({
    mobile: { $in: ["9876500001", "9876500002", "9876500003", "9876500004", "9876500005"] },
  })
    .select("patientId fullName status")
    .lean();

  console.log("[seed] demo patient seeding is disabled — nothing was created.");
  if (remaining.length > 0) {
    console.log(`[seed] ${remaining.length} row(s) still carry a demo mobile number:`);
    for (const row of remaining) {
      console.log(`         ${row.patientId}  ${row.fullName}  status=${row.status}`);
    }
  }

  await Patient.db.close();
  process.exit(0);
}

demoPatientsSeedingDisabled().catch((error) => {
  console.error("[seed] Failed:", error);
  process.exit(1);
});