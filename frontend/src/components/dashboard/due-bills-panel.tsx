"use client";

import { useQuery } from "@tanstack/react-query";
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import Link from "next/link";
import { BillsPanel } from "@/components/dashboard/bills-panel";
import { BillsTable, type ColumnDef } from "@/components/dashboard/bills-table";
import { queryKeys } from "@/lib/query-keys";
import { fetchOutstandingBills } from "@/services/dashboard";
import { formatMoney,formatDate } from "@/lib/utils";
import type { DueBill } from "@/types/dashboard";

const columns: ColumnDef<DueBill>[] = [
  { key: "index", width: "5%", label: "#", render: (_row, index) => index + 1 },
  {
    key: "billNo",
    width: "15%",
    label: "Bill No",
    render: (bill) => (
      <Link
        href={`/laboratory/billing/collect-dues?billId=${encodeURIComponent(bill.id)}`}
        className="font-medium text-primary hover:underline"
      >
        {bill.billNo}
      </Link>
    ),
  },
  { key: "patientId", width: "15%", label: "Pat Id" },
  { key: "patientName", width: "20%", label: "Pat Name" },
  {
    key: "net",
    width: "15%",
    label: "Net",
    align: "right",
    headerClassName: "text-left",
    render: (bill) => formatMoney(bill.net),
  },
  {
    key: "paid",
    width: "15%",
    label: "Paid",
    align: "right",
    headerClassName: "text-left",
    render: (bill) => formatMoney(bill.paid),
  },
  {
    key: "due",
    width: "15%",
    label: "Due",
    align: "right",
    headerClassName: "text-left",
    render: (bill) => formatMoney(bill.due),
  },
];

export function DueBillsPanel() {
  const [page,setPage]=useState(1);
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: [...queryKeys.dashboard, "outstanding-bills",page],
    queryFn: ()=>fetchOutstandingBills(page),
  });

  const rows = data?.items ?? [];
  const totalDue = data?.totalDue ?? 0;
  const pagedColumns:ColumnDef<(typeof rows)[number]>[]=[...columns.slice(0,4),{key:'billDate',width:'14%',label:'Bill Date',render:(bill:DueBill & {billDate:string})=>formatDate(bill.billDate)},...columns.slice(4)].map((column,index)=>({...column,width:[4,15,13,21,14,11,11,11][index]+'%',...(index===0?{render:(_row:DueBill,index:number)=>(page-1)*(data?.pagination.limit??20)+index+1}:{})}));

  return (
    <BillsPanel
      title="Outstanding Due Bills"
      referenceLayout
      isLoading={isLoading}
      isFetching={isFetching}
      isError={isError}
      errorMessage={error instanceof Error ? error.message : null}
      onRefresh={() => void refetch()}
    >
      <BillsTable
        tableClassName="lis-due-bills-table"
        columns={pagedColumns}
        rows={rows}
        rowKey={(bill) => bill.id}
        maxHeightClass="min-h-0 flex-1"

      />
      <div className="flex items-center justify-between gap-2 px-3 py-1 text-sm"><span>{data?.pagination.total??0} outstanding bills</span><div><Button size="sm" variant="outline" disabled={page<=1||isFetching} onClick={()=>setPage(value=>value-1)}>Previous</Button><span className="px-2">{page} / {data?.pagination.totalPages??1}</span><Button size="sm" variant="outline" disabled={!data||page>=data.pagination.totalPages||isFetching} onClick={()=>setPage(value=>value+1)}>Next</Button></div></div>
      <div className="lis-due-total flex justify-end items-center gap-6 border-t border-border bg-slate-50 px-3 py-2 text-lg" aria-label="Outstanding due total"><span>Total</span><output className="w-[140px] text-right">{formatMoney(totalDue)}</output></div>
    </BillsPanel>
  );
}
