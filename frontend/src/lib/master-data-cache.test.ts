import { strict as assert } from "node:assert";
import { test } from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { invalidateMasterData } from "./master-data-cache.ts";

for (const [root, affected] of Object.entries({
  "doctor-specialisations": ["doctor-specialisations", "doctors"],
  "doctor-designations": ["doctor-designations", "doctors"],
  departments: ["departments", "lab-tests", "lab-tariffs", "commission-mappings", "client-tariffs"],
  "lab-tests": ["lab-tests", "lab-tariffs", "commission-mappings", "client-tariffs"],
  "lab-tariffs": ["lab-tariffs", "lab-tests", "commission-mappings", "client-tariffs"],
})) {
  test(`${root} invalidates dependent queries without clearing unrelated data`, async () => {
    const client = new QueryClient();
    for (const key of [...affected, "unrelated"]) client.setQueryData([key, "options"], [{ id: "existing" }]);
    await invalidateMasterData(client, root);
    for (const key of affected) {
      assert.equal(client.getQueryState([key, "options"])?.isInvalidated, true);
      assert.deepEqual(client.getQueryData([key, "options"]), [{ id: "existing" }]);
    }
    assert.equal(client.getQueryState(["unrelated", "options"])?.isInvalidated, false);
    client.clear();
  });
}
