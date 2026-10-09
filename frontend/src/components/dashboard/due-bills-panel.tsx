"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { BillsPanel } from "@/components/dashboard/bills-panel";
import { BillsTable, type ColumnDef } from "@/components/dashboard/bills-table";
import { TableCell, TableRow } from "@/components/ui/table";
import { queryKeys } from "@/lib/query-keys";
import { fetchDueBills } from "@/services/dashboard";
import { formatMoney } from "@/lib/utils";
import type { DueBill } from "@/types/dashboard";

const columns: ColumnDef<DueBill>[] = [
  { key: "index", label: "#", className: "w-[44px]", render: (_row, index) => index + 1 },
  {
    key: "billNo",
    label: "Bill No",
    className: "w-[150px]",
    render: (bill) => (
      <Link
        href={`/laboratory/billing/collect-dues?billId=${encodeURIComponent(bill.id)}`}
        className="font-medium text-primary hover:underline"
      >
        {bill.billNo}
      </Link>
    ),
  },
  { key: "patientId", label: "Pat Id", className: "w-[130px]" },
  { key: "patientName", label: "Pat Name", className: "w-[180px]" },
  {
    key: "net",
    label: "Net",
    align: "right",
    className: "w-[100px]",
    render: (bill) => formatMoney(bill.net),
  },
  {
    key: "paid",
    label: "Paid",
    align: "right",
    className: "w-[100px]",
    render: (bill) => formatMoney(bill.paid),
  },
  {
    key: "due",
    label: "Due",
    align: "right",
    className: "w-[100px]",
    render: (bill) => formatMoney(bill.due),
  },
];

export function DueBillsPanel() {
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: [...queryKeys.dashboard, "due-bills"],
    queryFn: fetchDueBills,
  });

  const rows = data ?? [];
  const totalDue = rows.reduce((total, bill) => total + bill.due, 0);

  return (
    <BillsPanel
      title="Today's Due Bills"
      isLoading={isLoading}
      isFetching={isFetching}
      isError={isError}
      errorMessage={error instanceof Error ? error.message : null}
      onRefresh={() => void refetch()}
    >
      <BillsTable
        columns={columns}
        rows={rows}
        rowKey={(bill) => bill.id}
        maxHeightClass="min-h-0 flex-1"
        footer={
          <TableRow className="border-t border-border bg-slate-50 hover:bg-slate-50">
            <TableCell
              colSpan={columns.length - 1}
              className="border-t border-border px-3 py-2 text-right text-sm font-semibold text-slate-800"
            >
              Total
            </TableCell>
            <TableCell
              className="w-[100px] border-t border-border px-3 py-2 text-right text-sm font-semibold text-slate-800"
            >
              {formatMoney(totalDue)}
            </TableCell>
          </TableRow>
        }
      />
    </BillsPanel>
  );
}
