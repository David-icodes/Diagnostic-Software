"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { BillsPanel } from "@/components/dashboard/bills-panel";
import { BillsTable, type ColumnDef } from "@/components/dashboard/bills-table";
import { queryKeys } from "@/lib/query-keys";
import { fetchTodayBills } from "@/services/dashboard";
import type { TodayBill } from "@/types/dashboard";

const columns: ColumnDef<TodayBill>[] = [
  { key: "index", label: "#", className: "w-[44px]", render: (_row, index) => index + 1 },
  {
    key: "billNo",
    label: "Bill No",
    className: "w-[150px]",
    render: (bill) => (
      <Link
        href={`/billing/osp/${bill.id}`}
        className="font-medium text-primary hover:underline"
      >
        {bill.billNo}
      </Link>
    ),
  },
  { key: "patientId", label: "Pat Id", className: "w-[130px]" },
  { key: "patientName", label: "Pat Name", className: "w-[180px]" },
  { key: "age", label: "Age", className: "w-[64px]" },
  { key: "gender", label: "Gender", className: "w-[86px]" },
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
        rows={data ?? []}
        rowKey={(bill) => bill.id}
        maxHeightClass="min-h-0 flex-1"
      />
    </BillsPanel>
  );
}