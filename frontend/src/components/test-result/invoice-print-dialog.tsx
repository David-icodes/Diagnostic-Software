"use client";
import {api} from "@/lib/api";
import {PackageInvoiceDetails} from "@/components/billing/package-invoice-details";

import { createPortal, flushSync } from "react-dom";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatGender, formatMoney } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { rupeesInWords } from "@/lib/amount-words";
import { checkInvoicePrintEligibility } from "@/services/test-results";
import {openAuthorizedReportPdf} from "@/lib/browser-report";
import type {DueReceipt} from "@/types/billing";
import type { LabBill } from "@/types/billing";
import { selectedColumns } from "@/lib/catalogue-selection";
import { groupedBillItems } from "@/lib/package-billing";
import { formatPatientDisplayName } from "@/lib/patient-title";
import { patientAgeYears } from "@/lib/patient-age";
import { organisationBranding } from "@/config/organisation";

/** Billing reprint, separate from clinical test-result reports. No writes. */
export function InvoicePrintDialog({ bill, onClose, autoPrint = false, paymentReceipt }: { bill: LabBill; onClose: () => void; autoPrint?: boolean;paymentReceipt?:DueReceipt }) {
  const { user } = useAuth();
  const documentRef = useRef<HTMLDivElement>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const printing = useRef(false);
  const [busy, setBusy] = useState(false);
  /** Header preference is applied to the live preview before the print dialog opens. */
  const [includeHeader, setIncludeHeader] = useState(true);
  const patient = typeof bill.patientId === "object" ? bill.patientId : null;
  const autoStarted = useRef(false);
  const startPrint = useCallback(async (withHeader: boolean) => {
    if (printing.current || !patient) return;
    printing.current = true; setBusy(true); setPrintError(null);
    try {
      // Commit the selected header mode before the browser captures the page.
      flushSync(() => setIncludeHeader(withHeader));
      if(user?.role==="vendor") await api.get(`/vendor-portal/bills/${encodeURIComponent(bill.id)}/invoice-print-eligibility`);
      else await checkInvoicePrintEligibility(bill.id);
      const base=(process.env.NEXT_PUBLIC_API_URL??"http://localhost:5000/api/v1").replace(/\/$/,"");
      const path=user?.role==="vendor"?`/vendor-portal/bills/${encodeURIComponent(bill.id)}/invoice.pdf`:`/lab-bills/${encodeURIComponent(bill.id)}/invoice.pdf`;
      await openAuthorizedReportPdf(`${base}${path}?includeHeader=${withHeader}${paymentReceipt?`&paymentId=${encodeURIComponent(paymentReceipt.paymentId)}`:""}`);
    } catch (error) { setPrintError(error instanceof Error ? error.message : "Unable to print this bill."); }
    finally { printing.current = false; setBusy(false); }
  }, [bill.id, patient, user, paymentReceipt]);
  useEffect(() => { if (autoPrint && patient && !autoStarted.current) { autoStarted.current = true; void startPrint(true); } }, [autoPrint, patient, startPrint]);
  return createPortal(<Dialog open onOpenChange={(open) => { if (!open) onClose(); }} title="Lab bill print preview" size="lg" className="lis-print-dialog">
    <div className="lis-print-controls flex flex-wrap items-center justify-end gap-2 pb-3">
      {printError && <p role="alert" className="mr-auto text-xs text-destructive">{printError}</p>}
      <Button disabled={!patient || busy} onClick={() => void startPrint(true)}>{busy ? "Preparing…" : "Print with Header"}</Button>
      <Button disabled={!patient || busy} variant="secondary" onClick={() => void startPrint(false)}>Print without Header</Button>
      <Button variant="outline" onClick={onClose}>Close preview</Button>
    </div>
    {!patient ? <p role="alert">Patient information is not available for this bill.</p> : <div ref={documentRef}><InvoiceDocument bill={bill} printedBy={user?.name ?? ""} includeHeader={includeHeader} paymentReceipt={paymentReceipt} /></div>}
  </Dialog>, document.body);
}

/**
 * Compact GP investigation bill shared by the preview, browser print and the
 * WhatsApp invoice document. `includeHeader` only removes the business
 * letterhead; the bill title, patient details, investigations and totals remain.
 */
export function InvoiceDocument({ bill, includeHeader = true, paymentReceipt }: { bill: LabBill; printedBy: string; includeHeader?: boolean;paymentReceipt?:DueReceipt }) {
  const patient = typeof bill.patientId === "object" ? bill.patientId : null;
  if (!patient) return <p role="alert">Patient information is not available for this bill.</p>;
  const patientName = formatPatientDisplayName({
    title: patient.title,
    displayName: patient.displayName,
    fullName: patient.fullName,
  });
  const ageYears = patientAgeYears(patient);
  const billTitle = paymentReceipt?"Lab Payment Receipt":bill.billType === "vendor" ? "Vendor Investigation Bill" : "GP Investigation Bill";
  return (<div className="lis-print-document" aria-label="Lab bill invoice preview">
      <div className="lis-invoice-page-watermark" aria-hidden="true"><Image src="/Main logo.png" alt="" width={1254} height={1254} unoptimized loading="eager" /></div>
      <article className="lis-invoice-paper mx-auto">
        {includeHeader && (
          <header className="lis-invoice-compact-header">
            <h2 className="lis-invoice-brand">
              <Image src="/Main logo.png" alt="Anjali Diagnostics logo" width={1254} height={1254} unoptimized loading="eager" className="lis-invoice-logo" />
              {organisationBranding.name}
            </h2>
            <p className="lis-invoice-address">{organisationBranding.address}</p>
          </header>
        )}
        <h3 className="lis-invoice-title">{billTitle}</h3>
        <div className="lis-invoice-info">
          <div><strong>PATIENT ID</strong><span>: {patient.patientId}</span></div>
          <div><strong>BILL NO</strong><span>: {bill.billNumber}</span></div>
          <div><strong>PATIENT NAME</strong><span className="lis-invoice-patient-name">: {patientName}</span></div>
          <div><strong>BILL DATE</strong><span>: {formatDateTime(bill.createdAt)}</span></div>
          <div><strong>AGE/SEX</strong><span>: {ageYears === undefined ? "-" : `${ageYears} years`} / {formatGender(patient.gender)}</span></div>
          <div><strong>MOBILE</strong><span>: {patient.mobile}</span></div>
          <div><strong>REFER BY</strong><span>: {bill.doctorName ?? "Self"}</span></div>
        </div>
        <div className={`lis-invoice-tests mt-2 grid gap-2 ${bill.billType !== "vendor" && groupedBillItems(bill.items).length > 5 ? "grid-cols-2" : "grid-cols-1"}`}>
          {(bill.billType !== "vendor" ? selectedColumns(groupedBillItems(bill.items)) : [groupedBillItems(bill.items)]).map((column,columnIndex) => (
        <div key={columnIndex} className="lis-invoice-test-box"><table className="w-full table-fixed"><thead><tr><th className="w-8 text-left">SNo</th><th className="text-left">INVESTIGATIONS</th><th className="w-24 text-right">AMOUNT</th></tr></thead>
          <tbody>{column.map((item,index) => <Fragment key={item.testId}><tr><td>{columnIndex * 5 + index+1}</td><td className="lis-invoice-test-name break-words whitespace-normal">{item.testCode && item.testCode !== "INVG2044" && !item.includedTests ? `${item.testCode} - ` : ""}{item.testName}{item.includedTests ? ":" : ""}{item.quantity !== 1 ? ` × ${item.quantity}` : ""}</td><td className="lis-invoice-amount text-right font-bold">{item.includedTests?"":formatMoney(item.total)}</td></tr>
            {item.includedTests && <tr><td colSpan={3}><PackageInvoiceDetails members={item.includedTests} total={item.total}/></td></tr>}</Fragment>)}</tbody>
        </table></div>
          ))}
        </div>
        <div className="lis-invoice-totals grid grid-cols-1 gap-2 border border-t-0 border-black p-1 sm:grid-cols-2">
          <div>
            <p><strong>AMOUNT IN WORDS :</strong> {rupeesInWords(paymentReceipt?.amount??bill.netAmount)}</p>
            <p><strong>MODE OF PAYMENT :</strong> {(paymentReceipt?.paymentMode??bill.paymentMode).replaceAll("_"," ").toUpperCase()}</p>
            {bill.displayComments && <p>{bill.displayComments}</p>}
          </div>
          <dl className="grid grid-cols-2 text-right">
            <dt>TOTAL AMOUNT :</dt><dd>{formatMoney(bill.totalAmount)}</dd>
            {bill.discountAmount > 0 && <><dt>DISCOUNT :</dt><dd>{formatMoney(bill.discountAmount)}</dd></>}
            <dt>NET AMOUNT :</dt><dd className="lis-invoice-net font-bold">{formatMoney(bill.netAmount)}</dd>
            <dt>PAID AMOUNT :</dt><dd>{formatMoney(bill.paidAmount)}</dd>
            <dt>BALANCE AMOUNT :</dt><dd>{formatMoney(bill.dueAmount)}</dd>
          </dl>
        </div>
        <footer className="lis-invoice-footer"><strong>{organisationBranding.name}</strong><strong>AUTHORISED SIGNATURE</strong></footer>
      </article>
    </div>);
}
