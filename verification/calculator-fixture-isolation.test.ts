import test from "node:test";
import assert from "node:assert/strict";
import { assertCalculatorFixtureIsolation, calculatorFixtureOwnership, runFixtureCleanup } from "./calculator-fixture-isolation";

const database = "diagnostic_lis_calculator_" + "a".repeat(32);
const uri = `mongodb://127.0.0.1:27017/${database}`;
test("only a disposable local calculator database passes the fixture guard", () => {
  assert.doesNotThrow(() => assertCalculatorFixtureIsolation("test", uri, database));
});
test("production mode is rejected before connecting or creating fixtures", () => {
  assert.throws(() => assertCalculatorFixtureIsolation("production", uri, database), /forbidden in production/);
});
test("real catalogue and arbitrary local databases are rejected", () => {
  for (const name of ["diagnostic_lis", "test", "diagnostic_lis_calculator_backup"]) {
    assert.throws(() => assertCalculatorFixtureIsolation("test", `mongodb://127.0.0.1:27017/${name}`, name));
  }
});
test("remote hosts, credentials, query options and mismatched databases are rejected", () => {
  for (const target of [uri.replace("127.0.0.1", "remote.example"), uri.replace("127.0.0.1", "user:password@127.0.0.1"), uri + "?authSource=admin", uri + "other"]) {
    assert.throws(() => assertCalculatorFixtureIsolation("test", target, database));
  }
});

test("failed empty precondition preserves the database without any marker write or drop", async () => {
  const owner = calculatorFixtureOwnership("test", uri, database);
  let writes = 0; let drops = 0;
  await assert.rejects(owner.claim(1, async () => { writes++; }), /Existing database must be preserved/);
  await owner.cleanup(database, async () => true, async () => { drops++; });
  assert.equal(writes, 0); assert.equal(drops, 0);
});

test("unestablished ownership and failed marker creation never permit dropping", async () => {
  const owner = calculatorFixtureOwnership("test", uri, database);
  let drops = 0;
  await owner.cleanup(database, async () => true, async () => { drops++; });
  await assert.rejects(owner.claim(0, async () => { throw new Error("marker write failed"); }));
  await owner.cleanup(database, async () => true, async () => { drops++; });
  assert.equal(drops, 0);
});

test("confirmed ownership allows exactly one drop of this run's database", async () => {
  const owner = calculatorFixtureOwnership("test", uri, database);
  let drops = 0;
  await owner.claim(0, async () => {});
  await owner.cleanup(database, async () => true, async () => { drops++; });
  await owner.cleanup(database, async () => true, async () => { drops++; });
  assert.equal(drops, 1);
});

test("different database or missing run marker prevents cleanup even after claiming", async () => {
  const owner = calculatorFixtureOwnership("test", uri, database);
  let drops = 0;
  await owner.claim(0, async () => {});
  await assert.rejects(owner.cleanup(database.replaceAll("a", "b"), async () => true, async () => { drops++; }), /exact database/);
  await assert.rejects(owner.cleanup(database, async () => false, async () => { drops++; }), /marker missing or mismatched/);
  assert.equal(drops, 0);
});

test("cleanup reports failures, continues remaining tasks and preserves the primary error", async () => {
  const primary = new Error("initial empty precondition failed");
  const secondary = new Error("cleanup failed");
  const reports: string[] = []; let disconnected = false;
  await assert.rejects(runFixtureCleanup([
    {name: "drop", run: async () => { throw secondary; }},
    {name: "disconnect", run: async () => { disconnected = true; }},
  ], {error: primary}, (name, error) => { reports.push(name); assert.equal(error, secondary); }), error => error === primary);
  assert.deepEqual(reports, ["drop"]); assert.equal(disconnected, true);
});

test("cleanup failures still fail the run when there is no primary test failure", async () => {
  await assert.rejects(runFixtureCleanup([{name: "drop", run: async () => { throw new Error("drop failed"); }}], undefined, () => {}), AggregateError);
});
