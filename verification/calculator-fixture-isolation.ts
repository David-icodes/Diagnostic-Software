import assert from "node:assert/strict";

/** Verification-only: never imported by the application or catalogue tooling. */
export function assertCalculatorFixtureIsolation(mode: string | undefined, uri: string, database: string) {
  assert.notEqual(mode, "production", "Synthetic fixture creation is forbidden in production mode");
  assert.match(database, /^diagnostic_lis_calculator_[a-f0-9]{32}$/, "A disposable calculator database is required");
  assert.equal(uri, `mongodb://127.0.0.1:27017/${database}`, "Only the exact disposable loopback database is allowed");
}

/** Claim only after the empty precondition and a successful run-specific marker write. */
export function calculatorFixtureOwnership(mode: string | undefined, uri: string, database: string) {
  assertCalculatorFixtureIsolation(mode, uri, database);
  let owned = false;
  return {
    async claim(collectionCount: number, createMarker: () => Promise<void>) {
      assert.equal(owned, false, "Fixture ownership must only be established once");
      assert.equal(collectionCount, 0, "Existing database must be preserved");
      await createMarker();
      owned = true;
    },
    async cleanup(actualDatabase: string, verifyMarker: () => Promise<boolean>, drop: () => Promise<void>) {
      if (!owned) return;
      assert.equal(actualDatabase, database, "Cleanup must target this run's exact database");
      assertCalculatorFixtureIsolation(mode, uri, actualDatabase);
      assert.equal(await verifyMarker(), true, "Fixture ownership marker missing or mismatched; database preserved");
      await drop();
      owned = false;
    },
  };
}

/** Attempt every cleanup, reporting secondary failures without replacing the primary error. */
export async function runFixtureCleanup(
  tasks: {name: string; run: () => Promise<void>}[],
  primary: {error: unknown} | undefined,
  report: (name: string, error: unknown) => void,
) {
  const failures: unknown[] = [];
  for (const task of tasks) {
    try { await task.run(); }
    catch (error) { failures.push(error); report(task.name, error); }
  }
  if (primary) throw primary.error;
  if (failures.length) throw new AggregateError(failures, "Calculator fixture cleanup failed");
}
