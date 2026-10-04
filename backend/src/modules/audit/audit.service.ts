import type { Types } from "mongoose";
import { AuditLog } from "../../models/audit-log.model";

export interface AuditEntry {
  user: Types.ObjectId | string;
  action: string;
  entityType: string;
  entity: Types.ObjectId | string;
}

/**
 * Records an audit entry. Best-effort only: a failure here must never
 * roll back the primary operation.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await AuditLog.create({ ...entry, timestamp: new Date() });
  } catch (error) {
    console.error("[audit] failed to record entry:", error);
  }
}