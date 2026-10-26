"use client";
import Link from 'next/link';
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {api} from '@/lib/api';
import {Button} from '@/components/ui/button';
import {formatDate,formatMoney} from '@/lib/utils';
interface HistoryBill {collections?:{_id:string;reason:string;createdAt:string;supersededAt?:string;resultSnapshots:{parameterName:string;result:string|number|boolean;unit?:string}[]}[];id:string;billNumber:string;createdAt:string;status:string;netAmount:number;paidAmount:number;dueAmount:number;items:{testId:string;testName:string;total:number}[];payments:{_id:string;amount:number;discountAmount?:number;paymentMode:string;collectedAt:string}[];results:{_id:string;parameterName:string;result:string|number|boolean;unit?:string;superseded?:boolean;enteredAt:string}[];samples:{_id:string;sampleId:string;sampleStatus:string;comments?:string}[]}
interface History {clinicalVisible:boolean;pagination:{page:number;total:number;totalPages:number};bills:HistoryBill[]}
export function PatientHistory({patientId}:{patientId:string}){
 const [page,setPage]=useState(1);
 const history=useQuery({queryKey:['patients','history',patientId,page],queryFn:()=>api.get<History>(`/patients/${encodeURIComponent(patientId)}/history?page=${page}`)});
 return <section aria-label="Patient history" className="rounded border bg-white p-4">
  <h2 className="mb-3 text-lg font-medium">Patient history — visits, bills and payments</h2>
  {history.isPending?<p role="status">Loading patient history…</p>:history.isError?<p role="alert">{history.error.message}</p>:<>
   {!history.data.bills.length&&<p>No previous bills recorded.</p>}
   {history.data.bills.map(bill=><details key={bill.id} className="mb-3 rounded border p-3">
    <summary className="cursor-pointer font-medium">{bill.billNumber} · {formatDate(bill.createdAt)} · {bill.status} · Due ₹{formatMoney(bill.dueAmount)}</summary>
    <p className="my-2">Net ₹{formatMoney(bill.netAmount)} · Paid ₹{formatMoney(bill.paidAmount)} · Outstanding ₹{formatMoney(bill.dueAmount)}</p>
    <h3 className="font-semibold">Investigations</h3><ul>{bill.items.map((item,i)=><li key={`${item.testId}-${i}`}>{item.testName} — ₹{formatMoney(item.total)}</li>)}</ul>
    <h3 className="mt-3 font-semibold">Payments</h3>{bill.payments.length?bill.payments.map(payment=><p key={payment._id}>{formatDate(payment.collectedAt)} · {payment.paymentMode} · ₹{formatMoney(payment.amount)}{(payment.discountAmount??0)>0?` · Discount ₹${formatMoney(payment.discountAmount!)}`:''}</p>):<p>No separate collection receipts recorded.</p>}
    <h3 className="mt-3 font-semibold">Samples</h3>{bill.samples.map(sample=><p key={sample._id}>{sample.sampleId} · {sample.sampleStatus}{sample.comments?` · ${sample.comments}`:''}</p>)}
    {history.data.clinicalVisible&&<><h3 className="mt-3 font-semibold">Recorded results</h3>{bill.results.map(result=><p key={result._id}>{result.parameterName}: {String(result.result)} {result.unit}{result.superseded?' (previous collection)':''}</p>)}
    {bill.collections?.map(collection=><details key={collection._id} className="my-2 border p-2"><summary>{collection.supersededAt?"Previous collection":"Current collection"} · {formatDate(collection.createdAt)}</summary><p>{collection.reason}</p>{collection.resultSnapshots.map((row,i)=><p key={i}>{row.parameterName}: {String(row.result)} {row.unit}</p>)}</details>)}
    <Link href={`/laboratory/test-result/lab-reprint?billId=${encodeURIComponent(bill.id)}`} className="mt-2 inline-block text-primary underline">Open authorized report options</Link></>}
   </details>)}
   <div className="flex items-center gap-3"><Button variant="outline" disabled={page<=1} onClick={()=>setPage(page-1)}>Previous</Button><span>Page {page} · {history.data.pagination.total} bills</span><Button variant="outline" disabled={page>=history.data.pagination.totalPages} onClick={()=>setPage(page+1)}>Next</Button></div>
  </>}
 </section>;
}
