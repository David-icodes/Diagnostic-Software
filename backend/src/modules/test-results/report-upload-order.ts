/** Legacy attachments retain their original creation order; selecting an existing
 * PDF again changes selection metadata, never its bytes or original uploader. */
export function newestReportUpload<T extends {selectedAt?: Date; createdAt?: Date; _id?: unknown}>(rows: T[]): T[] {
  return [...rows].sort((a,b) =>
    new Date(b.selectedAt ?? b.createdAt ?? 0).getTime() - new Date(a.selectedAt ?? a.createdAt ?? 0).getTime()
    || String(b._id).localeCompare(String(a._id)));
}
