import test from "node:test";
import assert from "node:assert/strict";
import { reviewNumericMigration } from "./parameter-migration-review";
test("numeric migration preflight blocks nonnumeric histories, narrative rows and wrong profile IDs without mutation",()=>{
  const parameter={id:"rbc",testId:"cbp",resultType:"TEXT",unit:"mill/cumm"};
  const approved={id:"rbc",testId:"cbp",unit:"million/µL"};
  const copy={...parameter};
  const history=reviewNumericMigration(parameter,approved,["5","anisocytosis","",false]);
  assert.equal(history.allowed,false);assert.equal(history.nonNumericCount,3);
  assert.equal(reviewNumericMigration(parameter,{...approved,testId:"cbc"},[]).allowed,false);
  assert.equal(reviewNumericMigration({...parameter,itemType:"TEXT_AREA"},approved,[]).allowed,false);
  assert.equal(reviewNumericMigration(parameter,approved,[]).allowed,true);
  assert.deepEqual(parameter,copy);
});
