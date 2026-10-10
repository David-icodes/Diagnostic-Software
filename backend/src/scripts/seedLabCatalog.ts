import "dotenv/config";
import { connectDB } from "../config/db";
import { User } from "../models/user.model";
import { Department } from "../models/department.model";
import { LabTest } from "../models/lab-test.model";
import { LabTestParameter } from "../models/lab-test-parameter.model";
import { LabTechnician } from "../models/lab-technician.model";
import { Doctor } from "../models/doctor.model";
import { LabClient } from "../models/lab-client.model";
import { DoctorCommission } from "../models/doctor-commission.model";
import { OutsideLab } from "../models/outside-lab.model";
import { LabSample } from "../models/lab-sample.model";
import { LabBill } from "../models/lab-bill.model";
import { generateClientCode } from "../utils/id-generator";

interface DemoDepartment {
  name: string;
  code: string;
  sortOrder: number;
}

interface DemoTest {
  testCode: string;
  testName: string;
  shortName: string;
  departmentCode: string;
  price: number;
  resultMode: "PARAMETER_BASED" | "TEMPLATE_BASED" | "SIMPLE_RESULT" | "CALCULATED";
  sampleType?: string;
  containerType?: string;
  description?: string;
}

interface DemoDoctor {
  name: string;
  qualification: string;
  specialization: string;
  mobile: string;
}

const DEMO_DEPARTMENTS: DemoDepartment[] = [
  { name: "Biochemistry", code: "BIO", sortOrder: 1 },
  { name: "Hematology", code: "HEM", sortOrder: 2 },
  { name: "Microbiology", code: "MIC", sortOrder: 3 },
  { name: "Pathology", code: "PAT", sortOrder: 4 },
  { name: "Immunology / Serology", code: "IMM", sortOrder: 5 },
  { name: "Hormones", code: "HOR", sortOrder: 6 },
  { name: "Molecular Biology", code: "MOL", sortOrder: 7 },
  { name: "Clinical Pathology", code: "CLP", sortOrder: 8 },
  { name: "Packages / Profiles", code: "PKG", sortOrder: 9 },
];

const DEMO_TESTS: DemoTest[] = [
  {
    testCode: "BIO001",
    testName: "ALT (SGPT)",
    shortName: "SGPT",
    departmentCode: "BIO",
    price: 150,
    resultMode: "PARAMETER_BASED",
    sampleType: "Blood",
    containerType: "Plain (Serum)",
  },
  {
    testCode: "BIO002",
    testName: "AST (SGOT)",
    shortName: "SGOT",
    departmentCode: "BIO",
    price: 150,
    resultMode: "PARAMETER_BASED",
    sampleType: "Blood",
    containerType: "Plain (Serum)",
  },
  {
    testCode: "BIO003",
    testName: "Blood Sugar Fasting",
    shortName: "Glucose F",
    departmentCode: "BIO",
    price: 100,
    resultMode: "PARAMETER_BASED",
    sampleType: "Blood",
    containerType: "Fluoride",
  },
  {
    testCode: "BIO004",
    testName: "Serum Creatinine",
    shortName: "Creatinine",
    departmentCode: "BIO",
    price: 120,
    resultMode: "PARAMETER_BASED",
    sampleType: "Blood",
    containerType: "Plain (Serum)",
  },
  {
    testCode: "BIO005",
    testName: "Lipid Profile",
    shortName: "Lipid",
    departmentCode: "BIO",
    price: 550,
    resultMode: "PARAMETER_BASED",
    sampleType: "Blood",
    containerType: "Plain (Serum)",
  },
  {
    testCode: "BIO006",
    testName: "Total Bilirubin",
    shortName: "Bilirubin",
    departmentCode: "BIO",
    price: 130,
    resultMode: "PARAMETER_BASED",
    sampleType: "Blood",
    containerType: "Plain (Serum)",
  },
  {
    testCode: "HEM001",
    testName: "Complete Blood Count (CBC)",
    shortName: "CBC",
    departmentCode: "HEM",
    price: 300,
    resultMode: "PARAMETER_BASED",
    sampleType: "Blood",
    containerType: "EDTA",
  },
  {
    testCode: "HEM002",
    testName: "Hemoglobin (Hb)",
    shortName: "Hb",
    departmentCode: "HEM",
    price: 100,
    resultMode: "PARAMETER_BASED",
    sampleType: "Blood",
    containerType: "EDTA",
  },
  {
    testCode: "HEM003",
    testName: "ESR",
    shortName: "ESR",
    departmentCode: "HEM",
    price: 80,
    resultMode: "SIMPLE_RESULT",
    sampleType: "Blood",
    containerType: "Sodium Citrate",
  },
  {
    testCode: "MIC001",
    testName: "Widal Test",
    shortName: "Widal",
    departmentCode: "MIC",
    price: 250,
    resultMode: "TEMPLATE_BASED",
    sampleType: "Blood",
    containerType: "Plain (Serum)",
  },
  {
    testCode: "MIC002",
    testName: "Urine Culture & Sensitivity",
    shortName: "Urine C/S",
    departmentCode: "MIC",
    price: 500,
    resultMode: "TEMPLATE_BASED",
    sampleType: "Urine",
    containerType: "Sterile Container",
  },
  {
    testCode: "PAT001",
    testName: "Urine Routine Examination",
    shortName: "Urine R/E",
    departmentCode: "PAT",
    price: 120,
    resultMode: "PARAMETER_BASED",
    sampleType: "Urine",
    containerType: "Plain Container",
  },
  {
    testCode: "IMM001",
    testName: "C-Reactive Protein (CRP)",
    shortName: "CRP",
    departmentCode: "IMM",
    price: 400,
    resultMode: "SIMPLE_RESULT",
    sampleType: "Blood",
    containerType: "Plain (Serum)",
  },
  {
    testCode: "IMM002",
    testName: "Dengue NS1 Antigen",
    shortName: "Dengue NS1",
    departmentCode: "IMM",
    price: 600,
    resultMode: "SIMPLE_RESULT",
    sampleType: "Blood",
    containerType: "Plain (Serum)",
  },
  {
    testCode: "HOR001",
    testName: "TSH (Thyroid Stimulating Hormone)",
    shortName: "TSH",
    departmentCode: "HOR",
    price: 450,
    resultMode: "SIMPLE_RESULT",
    sampleType: "Blood",
    containerType: "Plain (Serum)",
  },
  {
    testCode: "MOL001",
    testName: "RT-PCR COVID-19",
    shortName: "COVID RT-PCR",
    departmentCode: "MOL",
    price: 700,
    resultMode: "SIMPLE_RESULT",
    sampleType: "Nasopharyngeal Swab",
    containerType: "VTM Tube",
  },
  {
    testCode: "PKG001",
    testName: "Basic Health Package (CBC + Glucose + Lipid)",
    shortName: "Basic Health Pkg",
    departmentCode: "PKG",
    price: 900,
    resultMode: "CALCULATED",
  },
  {
    testCode: "PKG002",
    testName: "Complete Thyroid Profile",
    shortName: "Thyroid Profile",
    departmentCode: "PKG",
    price: 800,
    resultMode: "CALCULATED",
  },
];

const DEMO_DOCTORS: DemoDoctor[] = [
  {
    name: "Dr. Anil Mehta",
    qualification: "MBBS, MD (Pathology)",
    specialization: "General Medicine",
    mobile: "9876510001",
  },
  {
    name: "Dr. Kavita Nair",
    qualification: "MBBS, MD (Microbiology)",
    specialization: "Infectious Diseases",
    mobile: "9876510002",
  },
];

interface DemoClient {
  name: string;
  contactPerson: string;
  mobile: string;
  phone: string;
  email: string;
  city: string;
}

const DEMO_CLIENTS: DemoClient[] = [
  {
    name: "Sterling Diagnostics LLP",
    contactPerson: "Rohit Sharma",
    mobile: "9876520001",
    phone: "022-40001234",
    email: "outsourcing@sterlingdiagnostics.example",
    city: "Mumbai",
  },
  {
    name: "Sai Health Care Foundation",
    contactPerson: "Meena Iyer",
    mobile: "9876520002",
    phone: "044-27891230",
    email: "lab@saihealthcare.example",
    city: "Chennai",
  },
];

interface DemoParameter {
  testCode: string;
  parameterName: string;
  displayOrder: number;
  resultType: "TEXT" | "NUMBER" | "BOOLEAN" | "SELECT" | "RANGE";
  unit?: string;
  referenceRange?: string;
  method?: string;
  options?: string[];
}

const DEMO_PARAMETERS: DemoParameter[] = [
  // CBC (HEM001)
  {
    testCode: "HEM001",
    parameterName: "Hemoglobin (Hb)",
    displayOrder: 1,
    resultType: "NUMBER",
    unit: "g/dL",
    referenceRange: "13.0–17.0 (M) / 12.0–15.0 (F)",
    method: "Automated",
  },
  {
    testCode: "HEM001",
    parameterName: "Total WBC Count",
    displayOrder: 2,
    resultType: "NUMBER",
    unit: "×10³/µL",
    referenceRange: "4.0–11.0",
    method: "Automated",
  },
  {
    testCode: "HEM001",
    parameterName: "RBC Count",
    displayOrder: 3,
    resultType: "NUMBER",
    unit: "×10⁶/µL",
    referenceRange: "4.5–5.5",
    method: "Automated",
  },
  {
    testCode: "HEM001",
    parameterName: "Platelet Count",
    displayOrder: 4,
    resultType: "NUMBER",
    unit: "×10³/µL",
    referenceRange: "150–410",
    method: "Automated",
  },
  {
    testCode: "HEM001",
    parameterName: "Hematocrit (PCV)",
    displayOrder: 5,
    resultType: "NUMBER",
    unit: "%",
    referenceRange: "40–52",
    method: "Automated",
  },
  {
    testCode: "HEM001",
    parameterName: "MCV",
    displayOrder: 6,
    resultType: "NUMBER",
    unit: "fL",
    referenceRange: "80–96",
    method: "Calculated",
  },
  {
    testCode: "HEM001",
    parameterName: "Differential Count (N/L/E/M/B)",
    displayOrder: 7,
    resultType: "TEXT",
    referenceRange: "N 40–75%, L 20–40%",
    method: "Microscopy",
  },
  // Lipid Profile (BIO005)
  {
    testCode: "BIO005",
    parameterName: "Total Cholesterol",
    displayOrder: 1,
    resultType: "NUMBER",
    unit: "mg/dL",
    referenceRange: "<200",
    method: "Enzymatic",
  },
  {
    testCode: "BIO005",
    parameterName: "Triglycerides",
    displayOrder: 2,
    resultType: "NUMBER",
    unit: "mg/dL",
    referenceRange: "<150",
    method: "Enzymatic",
  },
  {
    testCode: "BIO005",
    parameterName: "HDL Cholesterol",
    displayOrder: 3,
    resultType: "NUMBER",
    unit: "mg/dL",
    referenceRange: ">40 (M) / >50 (F)",
    method: "Direct",
  },
  {
    testCode: "BIO005",
    parameterName: "LDL Cholesterol",
    displayOrder: 4,
    resultType: "NUMBER",
    unit: "mg/dL",
    referenceRange: "<100",
    method: "Friedewald",
  },
  // Blood Sugar Fasting (BIO003)
  {
    testCode: "BIO003",
    parameterName: "Blood Sugar (Fasting)",
    displayOrder: 1,
    resultType: "NUMBER",
    unit: "mg/dL",
    referenceRange: "70–100",
    method: "Glucose Oxidase",
  },
  // ALT (BIO001)
  {
    testCode: "BIO001",
    parameterName: "ALT (SGPT)",
    displayOrder: 1,
    resultType: "NUMBER",
    unit: "U/L",
    referenceRange: "7–56",
    method: "IFCC without P5P",
  },
  // AST (BIO002)
  {
    testCode: "BIO002",
    parameterName: "AST (SGOT)",
    displayOrder: 1,
    resultType: "NUMBER",
    unit: "U/L",
    referenceRange: "10–40",
    method: "IFCC without P5P",
  },
  // Total Bilirubin (BIO006)
  {
    testCode: "BIO006",
    parameterName: "Total Bilirubin",
    displayOrder: 1,
    resultType: "NUMBER",
    unit: "mg/dL",
    referenceRange: "0.2–1.2",
    method: "Diazo",
  },
  // Serum Creatinine (BIO004)
  {
    testCode: "BIO004",
    parameterName: "Serum Creatinine",
    displayOrder: 1,
    resultType: "NUMBER",
    unit: "mg/dL",
    referenceRange: "0.6–1.2",
    method: "Jaffe",
  },
  // Urine Routine (PAT001)
  {
    testCode: "PAT001",
    parameterName: "Colour",
    displayOrder: 1,
    resultType: "TEXT",
    referenceRange: "Pale yellow",
    method: "Macroscopic",
  },
  {
    testCode: "PAT001",
    parameterName: "Appearance",
    displayOrder: 2,
    resultType: "TEXT",
    referenceRange: "Clear",
    method: "Macroscopic",
  },
  {
    testCode: "PAT001",
    parameterName: "Specific Gravity",
    displayOrder: 3,
    resultType: "RANGE",
    referenceRange: "1.010–1.025",
    method: "Refractometer",
  },
  {
    testCode: "PAT001",
    parameterName: "Protein",
    displayOrder: 4,
    resultType: "SELECT",
    options: ["Nil", "Trace", "+", "++", "+++"],
    referenceRange: "Nil",
    method: "Dipstick",
  },
  {
    testCode: "PAT001",
    parameterName: "Sugar",
    displayOrder: 5,
    resultType: "SELECT",
    options: ["Nil", "Trace", "+", "++", "+++"],
    referenceRange: "Nil",
    method: "Dipstick",
  },
  {
    testCode: "PAT001",
    parameterName: "Pus Cells",
    displayOrder: 6,
    resultType: "NUMBER",
    unit: "/hpf",
    referenceRange: "0–5",
    method: "Microscopy",
  },
  {
    testCode: "PAT001",
    parameterName: "Red Blood Cells",
    displayOrder: 7,
    resultType: "NUMBER",
    unit: "/hpf",
    referenceRange: "0–2",
    method: "Microscopy",
  },
];

interface DemoTechnician {
  name: string;
  designation: string;
  qualification: string;
  mobile: string;
  signatureNote: string;
}

const DEMO_TECHNICIANS: DemoTechnician[] = [
  {
    name: "Rajesh Kumar",
    designation: "Lab Technician",
    qualification: "B.Sc MLT",
    mobile: "9876530001",
    signatureNote: "R. Kumar",
  },
  {
    name: "Priya Sharma",
    designation: "Lab Technician",
    qualification: "DMLT",
    mobile: "9876530002",
    signatureNote: "P. Sharma",
  },
];

interface DemoCommission {
  doctorName: string;
  scope: "doctor" | "department" | "test";
  departmentCode?: string;
  testCode?: string;
  commissionPercent: number;
}

const DEMO_COMMISSIONS: DemoCommission[] = [
  // Dr. Anil Mehta has a flat doctor-level 10% commission.
  { doctorName: "Dr. Anil Mehta", scope: "doctor", commissionPercent: 10 },
  // Dr. Kavita Nair has a 12% Microbiology-department rate overridden by a
  // 15% exact-test rate for CBC; her BIO tests have no mapping so the report
  // can demonstrate the "config missing" flagging.
  { doctorName: "Dr. Kavita Nair", scope: "department", departmentCode: "MIC", commissionPercent: 12 },
  { doctorName: "Dr. Kavita Nair", scope: "test", departmentCode: "HEM", testCode: "HEM001", commissionPercent: 15 },
];

interface DemoOutsideLab {
  code: string;
  name: string;
  city: string;
}

const DEMO_OUTSIDE_LABS: DemoOutsideLab[] = [
  { code: "OUT001", name: "Metropolis Reference Lab", city: "Mumbai" },
  { code: "OUT002", name: "Neuberg Diagnostics", city: "Chennai" },
];

async function seedLabCatalog(): Promise<void> {
  await connectDB();

  const admin = await User.findOne({ role: "admin" });
  if (!admin) {
    throw new Error(
      "No admin user found. Run `npm run seed` first to seed the admin user.",
    );
  }

  let departmentsCreated = 0;
  const departmentIds = new Map<string, string>();

  for (const demo of DEMO_DEPARTMENTS) {
    let department = await Department.findOne({ code: demo.code });
    if (department) {
      console.log(`[seed] skip dept (exists) ${demo.code}`);
    } else {
      department = await Department.create({
        name: demo.name,
        code: demo.code,
        sortOrder: demo.sortOrder,
        description: undefined,
        createdBy: admin._id,
      });
      departmentsCreated += 1;
      console.log(`[seed] created dept ${demo.code} — ${demo.name}`);
    }
    departmentIds.set(demo.code, String(department._id));
  }

  let testsCreated = 0;
  for (const demo of DEMO_TESTS) {
    const exists = await LabTest.findOne({ testCode: demo.testCode });
    if (exists) {
      console.log(`[seed] skip test (exists) ${demo.testCode}`);
      continue;
    }
    await LabTest.create({
      testCode: demo.testCode,
      testName: demo.testName,
      shortName: demo.shortName,
      departmentId: departmentIds.get(demo.departmentCode),
      price: demo.price,
      resultMode: demo.resultMode,
      sampleType: demo.sampleType,
      containerType: demo.containerType,
      description: demo.description,
      active: true,
      createdBy: admin._id,
    });
    testsCreated += 1;
    console.log(`[seed] created test ${demo.testCode} — ${demo.testName}`);
  }

  let doctorsCreated = 0;
  for (const demo of DEMO_DOCTORS) {
    const exists = await Doctor.findOne({ name: demo.name });
    if (exists) {
      console.log(`[seed] skip doctor (exists) ${demo.name}`);
      continue;
    }
    await Doctor.create({
      ...demo,
      active: true,
      createdBy: admin._id,
    });
    doctorsCreated += 1;
    console.log(`[seed] created doctor ${demo.name}`);
  }

  let clientsCreated = 0;
  for (const demo of DEMO_CLIENTS) {
    const exists = await LabClient.findOne({ name: demo.name });
    if (exists) {
      console.log(`[seed] skip client (exists) ${demo.name}`);
      continue;
    }
    await LabClient.create({
      ...demo,
      clientCode: await generateClientCode(),
      active: true,
      createdBy: admin._id,
    });
    clientsCreated += 1;
    console.log(`[seed] created client ${demo.name}`);
  }

  let parametersCreated = 0;
  for (const demo of DEMO_PARAMETERS) {
    const test = await LabTest.findOne({ testCode: demo.testCode });
    if (!test) {
      console.log(`[seed] skip parameter (no test) ${demo.testCode}:${demo.parameterName}`);
      continue;
    }
    const exists = await LabTestParameter.findOne({
      testId: test._id,
      parameterName: demo.parameterName,
    });
    if (exists) {
      console.log(`[seed] skip parameter (exists) ${demo.testCode}:${demo.parameterName}`);
      continue;
    }
    await LabTestParameter.create({
      testId: test._id,
      parameterName: demo.parameterName,
      displayOrder: demo.displayOrder,
      resultType: demo.resultType,
      unit: demo.unit,
      referenceRange: demo.referenceRange,
      method: demo.method,
      options: demo.options,
      active: true,
      createdBy: admin._id,
    });
    parametersCreated += 1;
    console.log(`[seed] created parameter ${demo.testCode}:${demo.parameterName}`);
  }

  let techniciansCreated = 0;
  for (const demo of DEMO_TECHNICIANS) {
    const exists = await LabTechnician.findOne({ name: demo.name });
    if (exists) {
      console.log(`[seed] skip technician (exists) ${demo.name}`);
      continue;
    }
    await LabTechnician.create({
      ...demo,
      active: true,
      createdBy: admin._id,
    });
    techniciansCreated += 1;
    console.log(`[seed] created technician ${demo.name}`);
  }

  let commissionsCreated = 0;
  for (const demo of DEMO_COMMISSIONS) {
    const doctor = await Doctor.findOne({ name: demo.doctorName });
    if (!doctor) {
      console.log(`[seed] skip commission (no doctor) ${demo.doctorName}`);
      continue;
    }
    const scopeQuery: Record<string, string | undefined> = {
      doctorId: String(doctor._id),
      scope: demo.scope,
      departmentId: demo.departmentCode
        ? departmentIds.get(demo.departmentCode)
        : undefined,
      testId: demo.testCode
        ? String((await LabTest.findOne({ testCode: demo.testCode }))?._id)
        : undefined,
    };
    const exists = await DoctorCommission.findOne(
      Object.fromEntries(
        Object.entries(scopeQuery).filter(([, value]) => value !== undefined),
      ),
    );
    if (exists) {
      console.log(
        `[seed] skip commission (exists) ${demo.doctorName} ${demo.scope}`,
      );
      continue;
    }
    await DoctorCommission.create({
      ...scopeQuery,
      commissionPercent: demo.commissionPercent,
      active: true,
      createdBy: admin._id,
    });
    commissionsCreated += 1;
    console.log(
      `[seed] created commission ${demo.doctorName} ${demo.scope} ${demo.commissionPercent}%`,
    );
  }

  let commissionDemoAssigned = 0;
  const commissionDoctor = await Doctor.findOne({ name: "Dr. Anil Mehta" });
  if (commissionDoctor) {
    const billCandidates = await LabBill.find({
      referringDoctorId: { $exists: false },
      status: "generated",
    })
      .sort({ createdAt: 1 })
      .limit(5)
      .exec();
    for (const bill of billCandidates) {
      if (commissionDemoAssigned >= 3) break;
      bill.referringDoctorId = commissionDoctor._id;
      bill.doctorName = commissionDoctor.name;
      await bill.save();
      commissionDemoAssigned += 1;
    }
  }
  if (commissionDemoAssigned > 0) {
    console.log(
      `[seed] assigned referring doctor to ${commissionDemoAssigned} demo bills`,
    );
  }

  let outsideLabsCreated = 0;
  for (const demo of DEMO_OUTSIDE_LABS) {
    const exists = await OutsideLab.findOne({ code: demo.code });
    if (exists) {
      console.log(`[seed] skip outside lab (exists) ${demo.code}`);
      continue;
    }
    await OutsideLab.create({
      ...demo,
      active: true,
      createdBy: admin._id,
    });
    outsideLabsCreated += 1;
    console.log(`[seed] created outside lab ${demo.code} — ${demo.name}`);
  }

  let outsideSentMarked = 0;
  const outsideLabs = await OutsideLab.find({ active: true }).exec();
  if (outsideLabs.length > 0) {
    const candidates = await LabSample.find({ outsideLabId: { $exists: false } })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
    for (const sample of candidates) {
      if (outsideSentMarked >= 15) break;
      const lab = outsideLabs[Math.floor(Math.random() * outsideLabs.length)];
      const createdAt = sample.createdAt ?? new Date();
      sample.outsideLabId = lab._id;
      sample.sentOutAt = new Date(
        createdAt.getTime() +
          (24 + Math.floor(Math.random() * 72)) * 3_600_000,
      );
      await sample.save();
      outsideSentMarked += 1;
    }
  }
  if (outsideSentMarked > 0) {
    console.log(`[seed] marked ${outsideSentMarked} samples as sent to outside labs`);
  }

  console.log(
    `[seed] Lab catalog ready — departments: ${departmentsCreated} created, tests: ${testsCreated} created, doctors: ${doctorsCreated} created, clients: ${clientsCreated} created, parameters: ${parametersCreated} created, technicians: ${techniciansCreated} created, commissions: ${commissionsCreated} created, outside labs: ${outsideLabsCreated} created.`,
  );

  await Department.db.close();
  process.exit(0);
}

seedLabCatalog().catch((error) => {
  console.error("[seed] Failed to seed lab catalog:", error);
  process.exit(1);
});