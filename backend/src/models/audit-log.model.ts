import { model, Schema } from "mongoose";

/**
 * Minimal audit trail. Records who performed an action on which entity.
 * Kept deliberately small; extended in a later phase if needed.
 */
export interface IAuditLog {
  user: Schema.Types.ObjectId;
  action: string;
  entityType: string;
  entity: Schema.Types.ObjectId;
  timestamp: Date;
  /** Optional workflow metadata, without clinical results or credentials. */
  details?: Record<string, unknown>;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entity: { type: Schema.Types.ObjectId, refPath: "entityType", required: true },
    timestamp: { type: Date, default: Date.now, required: true },
    details: { type: Schema.Types.Mixed },
  },
  { versionKey: false },
);

auditLogSchema.index({ entity: 1, timestamp: -1 });
auditLogSchema.index({ user: 1, timestamp: -1 });

export const AuditLog = model<IAuditLog>("AuditLog", auditLogSchema);
