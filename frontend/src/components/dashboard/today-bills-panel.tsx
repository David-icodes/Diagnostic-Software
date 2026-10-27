"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { BillsPanel } from "@/components/dashboard/bills-panel";
import { BillsTable, type ColumnDef } from "@/components/dashboard/bills-table";
import { queryKeys } from "@/lib/query-keys";
import { fetchTodayBills } from "@/services/dashboard";
import type { TodayBill } from "@/types/dashboard";

const columns: ColumnDef<TodayBill>[] = [
 {key: "sno", width: "5%",label:"#",className:"w-[4.5%]",render:(_bill,index)=>index+1},
  {
    key: "billNo", width: "15%",
    label: "Bill No",
    className: "w-[16.5%] whitespace-nowrap",
    render: (bill) => <span className="font-medium">{bill.billNo}</span>,
  },
  { key: "patientId", width: "20%", label: "Pat Id", className: "w-[20%] whitespace-nowrap" },
  { key: "patientName", width: "30%", label: "Pat Name", className: "w-[27%] whitespace-normal", render: (bill) => <span title={bill.patientName}>{bill.patientName}{bill.vendorName&&<small className="block text-[11px] font-normal">Vendor: {bill.vendorName}</small>}</span> },
  { key: "age", width: "15%", label: "Age", className: "w-[20%] whitespace-normal" },
  { key: "gender", width: "15%", label: "Gender", className: "w-[12%]" },
];

export function TodayBillsPanel() {
  const { data, isLoading, isFetching, isError, error, refetch, hasNextPage, fetchNextPage } = useInfiniteQuery({
    queryKey: [...queryKeys.dashboard, "today-bills"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => fetchTodayBills(pageParam),
    getNextPageParam: page => page.length === 30 ? page.at(-1)?.id : undefined,
  });

  return (
    <BillsPanel
      title="Today Bills"
      referenceLayout
      isLoading={isLoading}
      isFetching={isFetching}
      isError={isError}
      errorMessage={error instanceof Error ? error.message : null}
      onRefresh={() => void refetch()}
    >
      <BillsTable
        columns={columns}
        tableClassName="lis-today-bills-table w-full"
        rows={Array.from(new Map((data?.pages.flat() ?? []).map(bill => [bill.id, bill])).values())}
        onScroll={event => {
          const el = event.currentTarget;
          if (hasNextPage && !isFetching && el.scrollHeight - el.scrollTop - el.clientHeight < 80) void fetchNextPage({cancelRefetch:false});
        }}
        rowKey={(bill) => bill.id}
        completedRow={(bill) => bill.completed}
        canLoadMore={hasNextPage&&!isFetching}
        onLoadMore={()=>void fetchNextPage({cancelRefetch:false})}
        maxHeightClass="min-h-0 flex-1"
      />
    </BillsPanel>
  );
}
