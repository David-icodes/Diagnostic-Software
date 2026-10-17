import test from 'node:test';
import assert from 'node:assert/strict';
import {recalculateConfigured} from './configured-calculations';
test('biochemistry chain follows exact source IDs after input changes and propagates missing sources',()=>{
 const source=(parameterId:string,unit='g/dl')=>({parameterId,parameterName:'Synthetic '+parameterId,resultType:'NUMBER',active:true,unit});
 const parameters=[source('total'),source('albumin'),{...source('globulin'),calculation:{formulaId:'globulin',expression:'S1 - S2',dependencyIds:['total','albumin']}},{...source('ratio','ratio'),calculation:{formulaId:'ag-ratio',expression:'S1 / S2',dependencyIds:['albumin','globulin']}}];
 const first=recalculateConfigured(parameters,{total:7,albumin:4});assert.deepEqual(first.errors,{});assert.equal(first.values.globulin,3);assert.equal(first.values.ratio,1.33);
 const changed=recalculateConfigured(parameters,{...first.values,total:8});assert.equal(changed.values.globulin,4);assert.equal(changed.values.ratio,1);assert.equal(changed.values.albumin,4);
 const missing=recalculateConfigured(parameters.filter(p=>p.parameterId!=='total'),{albumin:4});assert.ok(missing.errors.globulin);assert.ok(missing.errors.ratio);
 const circular=parameters.map(p=>p.parameterId==='globulin'?{...p,calculation:{formulaId:'globulin',expression:'S1 - S2',dependencyIds:['globulin','albumin']}}:p);assert.ok(recalculateConfigured(circular,{total:7,albumin:4}).errors.globulin);
});
