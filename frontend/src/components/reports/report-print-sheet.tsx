"use client";

import Image from "next/image";
import { organisationBranding, organisationContactLines } from "@/config/organisation";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export interface PrintColumn<T> {
  key: string;
  header: string;
  render: (row: T) => string;
  align?: "left" | "right" | "center";
}

interface ReportPrintSheetProps<T> {
  rows: T[];
  columns: PrintColumn<T>[];
  /** Report / printed title, e.g. "GP Patients Report". */
  title: string;
  subtitle?: string;
  criteria?: string;
  generatedAt?: string;
  summaryNote?: string;
  totals?: string[];
  signatureLabel?: string;
}

/**
 * Print-only render of a full report. Visible only when printing
 * (`hidden print:block`); the interactive page hides itself via print:hidden.
 */
export function ReportPrintSheet<T>({
  rows,
  columns,
  title,
  subtitle,
  criteria,
  generatedAt,
  summaryNote,
  totals,
  signatureLabel = "Authorised Signatory",
}: ReportPrintSheetProps<T>) {
  const alignClass = (align: PrintColumn<T>["align"]) =>
    align === "right"
      ? "text-right"
      : align === "center"
        ? "text-center"
        : "text-left";

  return (
    <section
      aria-label="Print preview"
      className="lis-a4-table-report hidden print:block"
      data-print-title={title}
    >
      <div className="text-sm text-slate-900">
        <header className="lis-report-print-brand border-b-2 border-slate-900 pb-2 text-center">
          {organisationBranding.logo && <Image src={organisationBranding.logo} alt={`${organisationBranding.name} logo`} width={66} height={66} unoptimized loading="eager" />}
          <div><h1 className="text-lg font-bold">{organisationBranding.name}</h1>
          {organisationBranding.address && <p className="text-xs">{organisationBranding.address}</p>}
          {organisationContactLines().map((line) => <p className="text-xs" key={line}>{line}</p>)}
          </div>
        </header>

        <div className="mt-3 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-base font-bold uppercase">{title}</h2>
            {subtitle && <p className="text-xs text-slate-600">{subtitle}</p>}
            {criteria && <p className="mt-1 text-xs text-slate-600">{criteria}</p>}
          </div>
          <div className="text-right text-xs text-slate-600">
            <p>
              Total Records : <span className="font-semibold">{rows.length}</span>
            </p>
            {summaryNote && <p className="font-medium">{summaryNote}</p>}
            <p>{generatedAt ? `Generated on ${formatDateTime(generatedAt)}` : ""}</p>
          </div>
        </div>

        <table className="mt-3 w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-y border-slate-900">
              <th className="border border-slate-400 px-2 py-1">#</th>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    "border border-slate-400 px-2 py-1",
                    alignClass(column.align),
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="border border-slate-400 px-2 py-4 text-center text-slate-600"
                >
                  No records to display.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={`${rowKey(row, index)}`} className="break-inside-avoid">
                  <td className="border border-slate-400 px-2 py-1">{index + 1}</td>
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        "border border-slate-400 px-2 py-1",
                        alignClass(column.align),
                      )}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {totals && totals.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-900 font-semibold">
                {totals.map((cell, index) => (
                  <td
                    key={`total-${index}`}
                    className={cn(
                      "border border-slate-400 px-2 py-1",
                      index === 0 && "text-right",
                    )}
                    colSpan={index === 0 ? 2 : 1}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>

        <div className="mt-6 flex items-end justify-between text-xs">
          <p className="text-slate-600">End of Report</p>
          <div className="text-center">
            <p className="border-t border-slate-900 px-6 pt-1">
              {signatureLabel}
            </p>
            <p className="text-[10px] text-slate-500">Signature</p>
          </div>
        </div>
      </div>
    </section>
  );

  function rowKey(row: T, index: number): string {
    const maybe = row as { id?: string };
    return maybe.id ? maybe.id : `row-${index}`;
  }
}
