"use client";

import { useMemo } from "react";
import { Banknote } from "lucide-react";
import { BillsPanel, type ColumnDef } from "@/components/dashboard/bills-panel";
import type { DueBill } from "@/types/dashboard";

interface DueBillsPanelProps {
  rows: DueBill[];
  isLoading?: boolean;
  isRefreshing?: boolean;
  error?: Error | null;
  onRefresh?: () => void;
  onRetry?: () => void;
}

export function DueBillsPanel({
  rows,
  isLoading,
  isRefreshing,
  error,
  onRefresh,
  onRetry,
}: DueBillsPanelProps) {
  const columns = useMemo<ColumnDef<DueBill>[]>(
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
      {
        key: "net",
        label: "Net",
        align: "right",
        className: "w-[90px]",
        render: (row) => Number(row.net).toLocaleString("en-IN"),
      },
      {
        key: "paid",
        label: "Paid",
        align: "right",
        className: "w-[90px]",
        render: (row) => Number(row.paid).toLocaleString("en-IN"),
      },
      {
        key: "due",
        label: "Due",
        align: "right",
        className: "w-[90px] font-medium text-amber-600",
        render: (row) => Number(row.due).toLocaleString("en-IN"),
      },
    ],
    [],
  );

  return (
    <BillsPanel
      title="Today's Due Bills"
      icon={Banknote}
      columns={columns}
      rows={rows}
      rowKey={(row, index) => `${row.billNo}-${index}`}
      isLoading={isLoading}
      isRefreshing={isRefreshing}
      error={error}
      onRefresh={onRefresh}
      onRetry={onRetry}
      emptyMessage="No Records To Display"
    />
  );
}