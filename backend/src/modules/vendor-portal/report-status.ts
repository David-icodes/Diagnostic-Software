export function vendorReportStatus(bill: {status?: string;items: {testId: unknown}[]}, workflow: {hasOutstandingDue: boolean;tests: {testId: string;submitted: boolean;uploadedReportId?: string}[]}) {
  const tests=new Map(workflow.tests.map(test=>[test.testId,test]));
  const ids=[...new Set(bill.items.map(item=>String(item.testId)))];
  const completed=bill.status!=="cancelled" && ids.length>0 && ids.every(id=>{const test=tests.get(id);return Boolean(test && (test.submitted || test.uploadedReportId));});
  return {reportStatus:bill.status==="cancelled"?"cancelled":completed?"completed":"processing",reportAvailable:completed && !workflow.hasOutstandingDue};
}
