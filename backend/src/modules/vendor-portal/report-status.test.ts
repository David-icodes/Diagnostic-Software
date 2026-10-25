import test from "node:test";
import assert from "node:assert/strict";
import {vendorReportStatus} from "./report-status";
test("vendor completed status requires every active unique investigation and release still checks dues",()=>{
 const bill={status:"generated",items:[{testId:"a"},{testId:"b"},{testId:"a"}]};
 assert.deepEqual(vendorReportStatus(bill,{hasOutstandingDue:false,tests:[{testId:"a",submitted:true},{testId:"b",submitted:false}]}),{reportStatus:"processing",reportAvailable:false});
 const tests=[{testId:"a",submitted:true},{testId:"b",submitted:false,uploadedReportId:"current-upload"}];
 assert.deepEqual(vendorReportStatus(bill,{hasOutstandingDue:false,tests}),{reportStatus:"completed",reportAvailable:true});
 assert.deepEqual(vendorReportStatus(bill,{hasOutstandingDue:true,tests}),{reportStatus:"completed",reportAvailable:false});
 assert.equal(vendorReportStatus({...bill,status:"cancelled"},{hasOutstandingDue:false,tests}).reportStatus,"cancelled");
 assert.equal(vendorReportStatus({...bill,items:[]},{hasOutstandingDue:false,tests}).reportAvailable,false);
 assert.equal(vendorReportStatus({...bill,items:[{testId:"a"}]},{hasOutstandingDue:false,tests:[{testId:"a",submitted:true},{testId:"removed",submitted:false}]}).reportAvailable,true);
});
