import type {BillItem} from "../types/billing";
export interface PackageMember {testId:string;testName:string;billedAmount?:number}
type DisplayBillItem=BillItem&{includedTests?:PackageMember[]};
/** Bill snapshots carry package allocations, not historical standalone catalogue prices. */
export function groupedBillItems(items:BillItem[]):DisplayBillItem[]{
 const grouped:DisplayBillItem[]=[],packages=new Map<string,DisplayBillItem>();
 const member=(row:DisplayBillItem,item:BillItem)=>{const existing=row.includedTests!.find(m=>m.testId===item.testId);if(existing)existing.billedAmount=(existing.billedAmount??0)+item.total;else row.includedTests!.push({testId:item.testId,testName:item.testName,billedAmount:item.total});};
 for(const item of items){
  if(!item.packageId){grouped.push({...item});continue;}
  const previous=packages.get(item.packageId);
  if(previous){previous.unitPrice+=item.unitPrice;previous.total+=item.total;member(previous,item);}
  else {const row:DisplayBillItem={...item,testId:item.packageId,testCode:"PACKAGE",testName:item.packageName??"Package",departmentName:"Packages/Profiles",includedTests:[]};member(row,item);packages.set(item.packageId,row);grouped.push(row);}
 }
 return grouped;
}
