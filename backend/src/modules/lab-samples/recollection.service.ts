import mongoose, { Types, type ClientSession } from "mongoose";
import { LabSample } from "../../models/lab-sample.model";
import { LabBill } from "../../models/lab-bill.model";
import { LabTestResult } from "../../models/lab-test-result.model";
import { SampleCollection } from "../../models/sample-collection.model";
import { AuditLog } from "../../models/audit-log.model";
import { ApiError } from "../../utils/api-error";
import { isSampleTransitionAllowed } from "../../utils/sample-lifecycle";

export function assertCollectionToken(active: unknown, supplied?: string) {
  if (String(active ?? "") !== (supplied ?? "")) throw new ApiError(409, "The sample collection changed. Reload and enter fresh results");
}

/** Both paths touch the same sample in a transaction: stale saves cannot resurrect results. */
export async function withSampleResultWrite<T>(billId: string, testId: string, supplied: string | undefined,
  write: (session?: ClientSession, collectionId?: Types.ObjectId) => Promise<T>): Promise<T> {
  return mongoose.connection.transaction(async session => {
    const options = session ? {session} : {};
    const fence = await LabBill.updateOne({_id:billId,status:"generated","items.testId":testId},{$inc:{sampleWriteRevision:1}},options).exec();
    if(fence.matchedCount!==1)throw new ApiError(409,"Bill changed. Reload before submitting");
    const sample = await LabSample.findOne({billId,testId}, null, options).exec();
    assertCollectionToken(sample?.activeCollectionId, supplied);
    if (sample?.activeCollectionId && ["RECOLLECTED", "REJECTED"].includes(sample.sampleStatus)) {
      throw new ApiError(422, "Collect the new sample before entering fresh results");
    }
    if(sample)await LabSample.updateOne({_id:sample._id},{$inc:{resultWriteRevision:1}},options).exec();
    return write(session, sample?.activeCollectionId);
  });
}

export async function recollectSample(userId: string, sampleId: string, reason: string | undefined, changedAt: Date) {
  if (!reason?.trim()) throw new ApiError(422, "Enter the reason for recollection");
  return mongoose.connection.transaction(async session => {
    const sample = await LabSample.findById(sampleId).session(session).exec();
    if (!sample) throw new ApiError(404, "Sample not found");
    if (!isSampleTransitionAllowed(sample.sampleStatus, "RECOLLECTED")) throw new ApiError(409, "Sample status changed. Reload before recollection");
    const bill = await LabBill.findOne({ _id: sample.billId, patientId: sample.patientId, status: "generated", "items.testId": sample.testId }).session(session).exec();
    if (!bill) throw new ApiError(422, "The sample is not linked to an active ordered test");
    await LabBill.updateOne({_id:bill._id},{$inc:{sampleWriteRevision:1}},{session}).exec();
    const results = await LabTestResult.find({ billId: sample.billId, patientId: sample.patientId, testId: sample.testId }).session(session).lean().exec();
    const identity = { sampleId: sample._id, billId: sample.billId, patientId: sample.patientId, testId: sample.testId };
    let previous = sample.activeCollectionId;
    if (previous) {
      const archived = await SampleCollection.updateOne({ _id: previous, sampleId: sample._id, supersededAt: { $exists: false } },
        { $set: { supersededAt: changedAt, supersededBy: userId, resultSnapshots: results } }, { session }).exec();
      if (archived.matchedCount !== 1) throw new ApiError(409, "Collection history could not be verified");
    } else {
      const [original] = await SampleCollection.create([{ ...identity, reason: "Original collection retained at recollection", createdBy: sample.createdBy,
        createdAt: sample.collectedAt ?? sample.createdAt, supersededAt: changedAt, supersededBy: userId, resultSnapshots: results }], { session });
      previous = original._id;
    }
    const [next] = await SampleCollection.create([{ ...identity, previousCollectionId: previous, reason: reason.trim(), createdBy: userId, createdAt: changedAt }], { session });
    await LabBill.updateOne({_id:bill._id,"items.testId":sample.testId},{$set:{"items.$.activeCollectionId":next._id}},{session}).exec();
    await LabTestResult.updateMany({ billId: sample.billId, patientId: sample.patientId, testId: sample.testId, superseded: { $ne: true } }, { $set: { superseded: true } }, { session }).exec();
    const saved = await LabSample.findOneAndUpdate({ _id: sample._id }, {
      $set: { activeCollectionId: next._id, sampleStatus: "RECOLLECTED", recollectedAt: changedAt, comments: reason.trim(), updatedBy: userId },
      $unset: { collectedAt: 1, receivedAt: 1, processedAt: 1, rejectedAt: 1 },
      $push: { history: { status: "RECOLLECTED", changedAt, changedBy: userId, comments: reason.trim() } },
    }, { session, new: true, runValidators: true }).exec();
    await AuditLog.create([{ user: userId, action: "sample.recollected", entityType: "LabSample", entity: sample._id, timestamp: changedAt,
      details: { collectionId: String(next._id), previousCollectionId: String(previous), archivedResults: results.length } }], { session });
    return saved!;
  });
}
