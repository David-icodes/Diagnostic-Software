/** Driver errors may include connection secrets. Expose only fixed categories. */
export function databaseFailureStage(error: unknown): string {
  const value = error as { code?: string | number; message?: string } | undefined;
  if (/querySrv|queryTxt|ENOTFOUND|ECONNREFUSED.*_mongodb/i.test(value?.message ?? "")) return "dns-resolution";
  if (value?.code === 18 || /authentication failed/i.test(value?.message ?? "")) return "authentication";
  return "connection";
}
export async function connectWithRetry(connect: () => Promise<unknown>, wait: (ms: number) => Promise<void>, diagnose: (stage: string, attempt: number) => void): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { await connect(); return; }
    catch (error) {
      const stage = databaseFailureStage(error);
      diagnose(stage, attempt);
      if (stage === "authentication" || attempt === 3) throw new Error(`Database startup failed (${stage}); connection not ready`);
      await wait(500 * 2 ** (attempt - 1));
    }
  }
}
