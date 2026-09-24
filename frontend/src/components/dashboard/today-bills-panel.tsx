"use client";

import { useMemo } from "react";
import { Receipt } from "lucide-react";
import { BillsPanel, type ColumnDef } from "@/components/dashboard/bills-panel";
import type { TodayBill } from "@/types/dashboard";

interface TodayBillsPanelProps {
  rows: TodayBill[];
  isLoading?: boolean;
  isRefreshing?: boolean;
  error?: Error | null;
  onRefresh?: () => void;
  onRetry?: () => void;
}

export function TodayBillsPanel({
  rows,
  isLoading,
  isRefreshing,
  error,
  onRefresh,
  onRetry,
}: TodayBillsPanelProps) {
  const columns = useMemo<ColumnDef<TodayBill>[]>(
    () => [
      {
        key: "index",
        label: "#",
        align: "center",
        className: "w-10",
        render: (_row, index) => index + 1,
      },
      {
        key: "billNo",
        label: "Bill No",
        className: "w-[120px]",
        render: (row) => (
          <span className="font-medium text-primary">{row.billNo}</span>
        ),
      },
      { key: "patientId", label: "Pat Id", className: "w-[110px]" },
      { key: "patientName", label: "Pat Name" },
      { key: "age", label: "Age", className: "w-[90px]" },
      { key: "gender", label: "Gender", className: "w-[90px]" },
    ],
    [],
  );

  return (
    <BillsPanel
      title="Today's Bills"
      icon={Receipt}
      columns={columns}
      rows={rows}
      rowKey={(row, index) => `${row.billNo}-${index}`}
      isLoading={isLoading}
      isRefreshing={isRefreshing}
      error={error}
      onRefresh={onRefresh}
      onRetry={onRetry}
    />
  );
}