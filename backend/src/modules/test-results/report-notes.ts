import {LabTest} from "../../models/lab-test.model";
/** Exact catalogue IDs only: similarly named tests must never share configuration. */
export async function readReportNotes(testIds:string[]) {
 const rows=await LabTest.find({_id:{$in:[...new Set(testIds)]}}).select("reportNote1 reportNote2 updatedAt").exec();
 return new Map(rows.map(row=>[String(row._id),{reportNote1:row.reportNote1??"",reportNote2:row.reportNote2??"",reportNotesVersion:row.updatedAt?.toISOString()??""}]));
}
