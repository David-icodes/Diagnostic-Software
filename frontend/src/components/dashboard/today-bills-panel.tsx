"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { BillsPanel } from "@/components/dashboard/bills-panel";
import { BillsTable, type ColumnDef } from "@/components/dashboard/bills-table";
import { queryKeys } from "@/lib/query-keys";
import { fetchTodayBills } from "@/services/dashboard";
import type { TodayBill } from "@/types/dashboard";

const columns: ColumnDef<TodayBill>[] = [
 {key: "sno", width: "3%",label:"#",className:"w-[3%]",render:(_bill,index)=>index+1},
  {
    key: "billNo", width: "21%",
    label: "Bill No",
    className: "w-[21%] whitespace-nowrap",
    render: (bill) => (
      <Link
        href={`/billing/osp/${bill.id}`}
        className="font-medium text-primary hover:underline"
      >
        {bill.billNo}
      </Link>
    ),
  },
  { key: "patientId", width: "18%", label: "Pat Id", className: "w-[18%] whitespace-nowrap" },
  { key: "patientName", width: "30%", label: "Pat Name", className: "w-[30%] whitespace-normal", render: (bill) => <span title={bill.patientName}>{bill.patientName}</span> },
  { key: "age", width: "18%", label: "Age", className: "w-[18%] whitespace-normal" },
  { key: "gender", width: "10%", label: "Gender", className: "w-[10%]" },
];

export function TodayBillsPanel() {
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: [...queryKeys.dashboard, "today-bills"],
    queryFn: fetchTodayBills,
  });

  return (
    <BillsPanel
      title="Today's Bills"
      isLoading={isLoading}
      isFetching={isFetching}
      isError={isError}
      errorMessage={error instanceof Error ? error.message : null}
      onRefresh={() => void refetch()}
    >
      <BillsTable
        columns={columns}
        tableClassName="lis-today-bills-table w-full"
        rows={data ?? []}
        rowKey={(bill) => bill.id}
        completedRow={(bill) => bill.completed}
        maxHeightClass="min-h-0 flex-1"
      />
    </BillsPanel>
  );
}
