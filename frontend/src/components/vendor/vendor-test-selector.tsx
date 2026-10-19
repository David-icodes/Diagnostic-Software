"use client";
import {TestSelector} from "@/components/billing/test-selector";
import type {LabTest} from "@/types/billing";
export type VendorTest={id:string;testName:string;testCode:string;departmentId:string;price:number;containerType?:string};
/** Same admin layout; all data is supplied by the authenticated vendor catalogue. */
export function VendorTestSelector({tests,departments,selected,onChange,disabled=false,quantities={}}:{tests:VendorTest[];departments:{id:string;name:string}[];selected:string[];onChange:(ids:string[])=>void;disabled?:boolean;quantities?:Record<string,number>}){
 const departmentRows=departments.map(department=>({...department,testCount:tests.filter(test=>test.departmentId===department.id).length}));
 const catalogue:LabTest[]=tests.map(test=>({...test,shortName:test.testName,active:true,resultMode:"PARAMETER_BASED"}));
 const items=selected.flatMap(id=>{const test=tests.find(test=>test.id===id);return test?[{testId:id,testName:test.testName,testCode:test.testCode,departmentName:departments.find(department=>department.id===test.departmentId)?.name??"—",unitPrice:test.price,quantity:quantities[id]??1,containerType:test.containerType??""}]:[];});
 return <TestSelector catalogueSource={{departments:departmentRows,tests:catalogue}} items={items} onAdd={test=>{if(!selected.includes(test.id))onChange([...selected,test.id]);}} onRemove={id=>onChange(selected.filter(value=>value!==id))} onQuantityChange={()=>{}} disabled={disabled} showSerial={false}/>;
}
