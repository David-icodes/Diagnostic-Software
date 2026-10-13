import test from "node:test";
import assert from "node:assert/strict";
import {recalculateConfigured,calculatorControlState} from "./configured-calculations";
test("inactive source and target bindings cannot execute even with supplied values",()=>{
 const sources=[{parameterId:'hb',parameterName:'Hb',unit:'g/dL'},{parameterId:'rbc',parameterName:'RBC',unit:'million/µL'}];
 const target={parameterId:'mch',parameterName:'MCH',unit:'pg',calculation:{formulaId:'mch',dependencyIds:['hb','rbc']}};
 const values={hb:15,rbc:5,mch:99};
 const inactiveTarget={...target,active:false};
 assert.equal(calculatorControlState(inactiveTarget).status,'ineligible');
 assert.equal(recalculateConfigured([...sources,inactiveTarget],values).values.mch,'');
 assert.match(recalculateConfigured([{...sources[0],active:false},sources[1],target],values).errors.mch,/inactive/i);
});
