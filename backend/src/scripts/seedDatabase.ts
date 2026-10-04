import "dotenv/config";
import type { Types } from "mongoose";
import { connectDB } from "../config/db";
import { User } from "../models/user.model";
import { DoctorSpecialisation } from "../models/doctor-specialisation.model";
import { DoctorDesignation } from "../models/doctor-designation.model";
import { Location } from "../models/location.model";
import { Department } from "../models/department.model";
import { LabTest, type ILabTest } from "../models/lab-test.model";
import { LabPackage, type ILabPackage } from "../models/lab-package.model";
import { Doctor } from "../models/doctor.model";
import type { LocationLevel } from "../constants/master-data";

interface SeedDepartment {
  name: string;
  code: string;
  description: string;
}

interface FeverTest {
  testCode: string;
  testName: string;
  shortName: string;
  departmentCode: string;
  price: number;
}

interface SeedPackage {
  seedKey: string;
  name: string;
  amount: number;
  insAmount: number;
  testCodes?: string[];
}

const SEED_SPECIALISATIONS = [
  "Cardiology",
  "Dermatology",
  "General Medicine",
  "Orthopedics",
  "Pediatrics",
  "Pathology",
  "Radiology",
];

const SEED_DESIGNATIONS = [
  "Consultant",
  "Senior Consultant",
  "HOD",
  "Resident",
  "Visiting Consultant",
];

const SEED_LOCATIONS: { type: LocationLevel; name: string; parent: string | null }[] = [
  { type: "country", name: "India", parent: null },
  { type: "state", name: "Tamil Nadu", parent: "India" },
  { type: "state", name: "Karnataka", parent: "India" },
  { type: "district", name: "Chennai", parent: "Tamil Nadu" },
  { type: "district", name: "Coimbatore", parent: "Tamil Nadu" },
  { type: "district", name: "Bengaluru", parent: "Karnataka" },
  { type: "city", name: "T. Nagar", parent: "Chennai" },
  { type: "city", name: "Velachery", parent: "Chennai" },
  { type: "city", name: "R.S. Puram", parent: "Coimbatore" },
  { type: "city", name: "Indiranagar", parent: "Bengaluru" },
];

const FEVER_TEST_DEPARTMENTS: SeedDepartment[] = [
  { name: "Biochemistry", code: "BIO", description: "Clinical biochemistry tests" },
  { name: "Hematology", code: "HEM", description: "Blood and haematology tests" },
  { name: "Microbiology", code: "MIC", description: "Microbiology culture and serology" },
  { name: "Pathology", code: "PAT", description: "Histopathology and cytology" },
];

const FEVER_TESTS: FeverTest[] = [
  {
    testCode: "HEM_CBP",
    testName: "COMPLETE BLOOD PICTURE",
    shortName: "CBP",
    departmentCode: "HEM",
    price: 450,
  },
  {
    testCode: "BIO_ESR",
    testName: "Erythrocyte sedimentation rate(Esr)",
    shortName: "ESR",
    departmentCode: "BIO",
    price: 100,
  },
  {
    testCode: "MIC_WIDAL",
    testName: "WIDAL",
    shortName: "Widal",
    departmentCode: "MIC",
    price: 200,
  },
  {
    testCode: "HEM_MAL",
    testName: "MALARIA",
    shortName: "Malaria",
    departmentCode: "HEM",
    price: 150,
  },
  {
    testCode: "BIO_CRP",
    testName: "CRP (C - REACTIVE PROTEIN)",
    shortName: "CRP",
    departmentCode: "BIO",
    price: 350,
  },
  {
    testCode: "PAT_CUE",
    testName: "COMPLETE URINE EXAMINATION",
    shortName: "CUE",
    departmentCode: "PAT",
    price: 100,
  },
];

const SEED_PACKAGES: SeedPackage[] = [
  { seedKey: "pkg-master-package-2", name: "MASTER PACKAGE-2", amount: 2000, insAmount: 2000 },
  {
    seedKey: "pkg-fever-profile",
    name: "FEVER PROFILE",
    amount: 1380,
    insAmount: 1380,
    testCodes: FEVER_TESTS.map((test) => test.testCode),
  },
  { seedKey: "pkg-fever-profile-2", name: "FEVER PROFILE2", amount: 1600, insAmount: 1600 },
  { seedKey: "pkg-diabetic-profile-1", name: "DIABETIC PROFILE-1", amount: 1200, insAmount: 1200 },
  { seedKey: "pkg-master-profile-3", name: "MASTER PROFILE3", amount: 2500, insAmount: 7500 },
  { seedKey: "pkg-renal-profile-2-rp2", name: "RENAL PROFILE2 (RP2)", amount: 800, insAmount: 800 },
  { seedKey: "pkg-vitamin-profile-1", name: "VITAMIN PROFILE", amount: 1500, insAmount: 1500 },
  { seedKey: "pkg-renal-profile-2", name: "RENAL PROFILE-II", amount: 950, insAmount: 950 },
  { seedKey: "pkg-minor-surgical", name: "MINOR SURGICAL PROFILE", amount: 1000, insAmount: 1000 },
  { seedKey: "pkg-antenatal", name: "ANTENATAL PROFILE", amount: 1800, insAmount: 1800 },
  { seedKey: "pkg-diabetic-profile-2", name: "DIABETIC PROFILE2", amount: 1450, insAmount: 1450 },
  { seedKey: "pkg-vitamin-profile-2", name: "VITAMIN PROFILE", amount: 1500, insAmount: 1500 },
  { seedKey: "pkg-master-profile-4", name: "MASTER PROFILE-4", amount: 3000, insAmount: 7000 },
  { seedKey: "pkg-antifungal", name: "ANTIFUNGAL PROFILE", amount: 1950, insAmount: 1950 },
];

const SEED_DOCTORS: { title: string; designation: string; specialisation: string; department: string }[] = [
  { title: "Dr. Ramesh Gupta", designation: "Consultant", specialisation: "Cardiology", department: "Lab & X-Ray" },
  { title: "Dr. Priya Sharma", designation: "Senior Consultant", specialisation: "General Medicine", department: "Service" },
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function run() {
  const admin = await User.findOne({ role: "admin" }).exec();
  const createdBy = admin ? admin._id : undefined;

  // 1. Doctor specialisations
  for (const name of SEED_SPECIALISATIONS) {
    const existing = await DoctorSpecialisation.findOne({
      name: { $regex: `^${escapeRegExp(name)}$`, $options: "i" },
    }).exec();
    if (existing) continue;
    await DoctorSpecialisation.create({ name, active: true, createdBy });
  }

  // 2. Doctor designations
  for (const name of SEED_DESIGNATIONS) {
    const existing = await DoctorDesignation.findOne({
      name: { $regex: `^${escapeRegExp(name)}$`, $options: "i" },
    }).exec();
    if (existing) continue;
    await DoctorDesignation.create({ name, active: true, createdBy });
  }

  // 3. Locations (hierarchical)
  const locationCache = new Map<string, Types.ObjectId>();
  for (const entry of SEED_LOCATIONS) {
    const parentId = entry.parent ? locationCache.get(entry.parent) : null;
    const existing = await Location.findOne({
      type: entry.type,
      name: { $regex: `^${escapeRegExp(entry.name)}$`, $options: "i" },
      ...(parentId ? { parentId } : { parentId: null }),
    }).exec();
    if (existing) {
      locationCache.set(entry.name, existing._id);
      continue;
    }
    const created = await Location.create({
      type: entry.type,
      name: entry.name,
      parentId,
      active: true,
      createdBy,
    });
    locationCache.set(entry.name, created._id);
  }

  // 4. Departments (BIO/HEM/MIC/PAT needed by the fever profile package)
  const departmentCache = new Map<string, Types.ObjectId>();
  for (const dept of FEVER_TEST_DEPARTMENTS) {
    const existing = await Department.findOne({ code: dept.code }).exec();
    if (existing) {
      departmentCache.set(dept.code, existing._id);
      continue;
    }
    const created = await Department.create({
      name: dept.name,
      code: dept.code,
      description: dept.description,
      type: "Lab & X-Ray",
      sortOrder: 0,
      active: true,
      createdBy,
    });
    departmentCache.set(dept.code, created._id);
  }

  // 5. FEVER PROFILE tests
  const feverTestIds = new Map<string, Types.ObjectId>();
  for (const test of FEVER_TESTS) {
    const departmentId = departmentCache.get(test.departmentCode);
    if (!departmentId) throw new Error(`Missing department ${test.departmentCode}`);
    const existing = await LabTest.findOne({ testCode: test.testCode }).exec();
    if (existing) {
      const id = existing._id as unknown as Types.ObjectId;
      feverTestIds.set(test.testCode, id);
      continue;
    }
    const created = (await LabTest.create({
      testCode: test.testCode,
      testName: test.testName,
      shortName: test.shortName,
      departmentId,
      price: test.price,
      resultMode: "SIMPLE_RESULT",
      active: true,
      ...(createdBy ? { createdBy } : {}),
    } as ILabTest)) as unknown as { _id: Types.ObjectId };
    feverTestIds.set(test.testCode, created._id);
  }

  // 6. Packages (idempotent by stable seed key; duplicate names preserved)
  for (const pkg of SEED_PACKAGES) {
    const items = (pkg.testCodes ?? [])
      .map((code) => {
        const testId = feverTestIds.get(code);
        if (!testId) throw new Error(`Missing fever test ${code}`);
        const test = FEVER_TESTS.find((entry) => entry.testCode === code);
        const departmentId = test ? departmentCache.get(test.departmentCode) : undefined;
        if (!departmentId) throw new Error(`Missing department for ${code}`);
        return { testId, departmentId };
      });

    const existing = await LabPackage.findOne({ seedKey: pkg.seedKey }).exec();
    if (existing) {
      await LabPackage.updateOne(
        { _id: existing._id },
        {
          $set: {
            name: pkg.name,
            packageType: "Lab",
            amount: pkg.amount,
            insAmount: pkg.insAmount,
            items,
            ...(createdBy ? { updatedBy: createdBy } : {}),
          },
        },
      ).exec();
      continue;
    }
    await LabPackage.create({
      seedKey: pkg.seedKey,
      name: pkg.name,
      packageType: "Lab",
      amount: pkg.amount,
      insAmount: pkg.insAmount,
      items,
      active: true,
      ...(createdBy ? { createdBy } : {}),
    } as ILabPackage);
  }

  // 7. Demo doctors referencing the seeded masters (guarded by unique name)
  for (const entry of SEED_DOCTORS) {
    const spec = await DoctorSpecialisation.findOne({
      name: { $regex: `^${escapeRegExp(entry.specialisation)}$`, $options: "i" },
    }).exec();
    const designation = await DoctorDesignation.findOne({
      name: { $regex: `^${escapeRegExp(entry.designation)}$`, $options: "i" },
    }).exec();
    const existing = await Doctor.findOne({
      name: { $regex: `^${escapeRegExp(entry.title)}$`, $options: "i" },
    }).exec();
    if (existing) continue;
    const [firstName, ...rest] = entry.title.split(" ");
    await Doctor.create({
      name: entry.title,
      firstName: firstName ?? "",
      lastName: rest.join(" ") || "",
      qualification: "MBBS, MD",
      specialization: spec?.name ?? entry.specialisation,
      specialisationId: spec?._id,
      designation: designation?.name ?? entry.designation,
      designationId: designation?._id,
      doctorType: "Consultant",
      onlineAppDisplay: "Y",
      active: true,
      ...(createdBy ? { createdBy } : {}),
    } as never);
  }

  console.log(
    `Seed complete: ${SEED_SPECIALISATIONS.length} specialisations, ${SEED_DESIGNATIONS.length} designations, ` +
      `${SEED_LOCATIONS.length} locations, ${FEVER_TEST_DEPARTMENTS.length} departments, ` +
      `${FEVER_TESTS.length} fever tests, ${SEED_PACKAGES.length} packages, ${SEED_DOCTORS.length} demo doctors.`,
  );
}

connectDB()
  .then(run)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });