import type { BillItem } from "../types/billing";
/** Display each fixed package charge once; persisted items retain every real investigation. */
export function groupedBillItems(items:BillItem[]):BillItem[]{
 const grouped:BillItem[]=[];const packages=new Map<string,BillItem>();
 for(const item of items){if(!item.packageId){grouped.push({...item});continue;}const previous=packages.get(item.packageId);if(previous){previous.unitPrice+=item.unitPrice;previous.total+=item.total;}else{const row={...item,testId:item.packageId,testCode:"PACKAGE",testName:item.packageName??"Package",departmentName:"Packages/Profiles"};packages.set(item.packageId,row);grouped.push(row);}}
 return grouped;
}
