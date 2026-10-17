"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
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
    headerClassName: "text-right",
    render: (bill) => formatMoney(bill.net),
  },
  {
    key: "paid",
    width: "15%",
    label: "Paid",
    align: "right",
    headerClassName: "text-right",
    render: (bill) => formatMoney(bill.paid),
  },
  {
    key: "due",
    width: "15%",
    label: "Due",
    align: "right",
    headerClassName: "text-right",
    render: (bill) => formatMoney(bill.due),
  },
];

export function DueBillsPanel() {
  const { data, isLoading, isFetching, isError, error, refetch,hasNextPage,fetchNextPage } = useInfiniteQuery({
    initialPageParam:undefined as string|undefined,
    queryKey: [...queryKeys.dashboard, "outstanding-bills"],
    queryFn: ({pageParam})=>fetchOutstandingBills(pageParam),
    getNextPageParam:page=>page.nextCursor,
  });

  const rows = [...new Map((data?.pages.flatMap(page=>page.items)??[]).map(row=>[row.id,row])).values()];
  const latest=data?.pages.at(-1);
  const totalDue = latest?.totalDue ?? 0;
  const pagedColumns:ColumnDef<(typeof rows)[number]>[]=[...columns.slice(0,4),{key:'billDate',width:'14%',label:'Bill Date',render:(bill:DueBill & {billDate:string})=>formatDate(bill.billDate)},...columns.slice(4)].map((column,index)=>({...column,width:[4,15,13,20,12,12,12,12][index]+'%',...(index===0?{render:(_row:DueBill,index:number)=>index+1}:{})}));

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
        canLoadMore={hasNextPage&&!isFetching}
        onLoadMore={()=>void fetchNextPage({cancelRefetch:false})}
        rowKey={(bill) => bill.id}
        maxHeightClass="min-h-0 flex-1"
        onScroll={event=>{const node=event.currentTarget;if(hasNextPage&&!isFetching&&node.scrollHeight-node.scrollTop-node.clientHeight<80)void fetchNextPage({cancelRefetch:false});}}

      />
      <div className="px-3 py-1 text-sm" role="status">{latest?.pagination.total??0} outstanding bills{hasNextPage?" · Scroll to load more":""}</div>
      <div className="lis-due-total flex justify-end items-center gap-6 border-t border-border bg-slate-50 px-3 py-2 text-lg" aria-label="Outstanding due total"><span>Total</span><output className="w-[140px] text-right">{formatMoney(totalDue)}</output></div>
    </BillsPanel>
  );
}
