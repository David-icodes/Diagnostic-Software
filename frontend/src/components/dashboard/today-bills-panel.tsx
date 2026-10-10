"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { BillsPanel } from "@/components/dashboard/bills-panel";
import { BillsTable, type ColumnDef } from "@/components/dashboard/bills-table";
import { queryKeys } from "@/lib/query-keys";
import { fetchTodayBills } from "@/services/dashboard";
import type { TodayBill } from "@/types/dashboard";

const columns: ColumnDef<TodayBill>[] = [
  {
    key: "billNo",
    label: "Bill No",
    className: "w-1/5 truncate",
    render: (bill) => (
      <Link
        href={`/billing/osp/${bill.id}`}
        className="font-medium text-primary hover:underline"
      >
        {bill.billNo}
      </Link>
    ),
  },
  { key: "patientId", label: "Pat Id", className: "w-1/5 truncate" },
  { key: "patientName", label: "Pat Name", className: "w-1/5 truncate", render: (bill) => <span title={bill.patientName}>{bill.patientName}</span> },
  { key: "age", label: "Age", className: "w-1/5 truncate" },
  { key: "gender", label: "Gender", className: "w-1/5 truncate" },
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
