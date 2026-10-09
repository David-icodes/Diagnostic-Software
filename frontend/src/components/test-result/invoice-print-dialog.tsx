"use client";

import { createPortal } from "react-dom";
import { useRef, useState } from "react";
import Image from "next/image";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatGender, formatMoney } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { rupeesInWords } from "@/lib/amount-words";
import { printDocument } from "@/lib/print-document";
import type { LabBill } from "@/types/billing";

/** Billing reprint, separate from clinical test-result reports. No writes. */
export function InvoicePrintDialog({ bill, onClose }: { bill: LabBill; onClose: () => void }) {
  const { user } = useAuth();
  const documentRef = useRef<HTMLDivElement>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const patient = typeof bill.patientId === "object" ? bill.patientId : null;
  return createPortal(<Dialog open onOpenChange={(open) => { if (!open) onClose(); }} title="Lab bill print preview" size="lg" className="lis-print-dialog">
    <div className="lis-print-controls flex justify-end gap-2 pb-3">
      {printError && <p role="alert">{printError}</p>}
      <Button disabled={!patient} onClick={async () => { setPrintError(null); try { await printDocument(documentRef.current); } catch (error) { setPrintError(error instanceof Error ? error.message : "Unable to print this bill."); } }}>Print bill</Button>
      <Button variant="outline" onClick={onClose}>Close preview</Button>
    </div>
    {!patient ? <p role="alert">Patient information is not available for this bill.</p> : <div ref={documentRef}><InvoiceDocument bill={bill} printedBy={user?.name ?? ""} /></div>}
  </Dialog>, document.body);
}

export function InvoiceDocument({ bill, printedBy }: { bill: LabBill; printedBy: string }) {
  const patient = typeof bill.patientId === "object" ? bill.patientId : null;
  if (!patient) return <p role="alert">Patient information is not available for this bill.</p>;
  return (<div  className="lis-print-document" aria-label="Lab bill invoice preview">
      <div className="lis-invoice-page-watermark" aria-hidden="true"><Image src="/Main logo.png" alt="" width={1254} height={1254} unoptimized loading="eager" /></div>
      <article className="lis-invoice-paper mx-auto">
        <header className="flex items-start justify-between gap-6 pb-2">
          <h2 className="lis-invoice-brand"><Image src="/Main logo.png" alt="Anjali Diagnostics logo" width={1254} height={1254} unoptimized loading="eager" className="lis-invoice-logo" />Anjali Diagnostics</h2>
          <p>Plot No. 347, HMT Hills, Opp. Community Hall,<br />Beside Park, Opp. JNTU, Kukatpally, Hyderabad.<br />Ph: 9440626892</p>
        </header>
        <h3 className="border border-black text-center font-bold">GP Investigation Bill</h3>
        <div className="lis-invoice-info">
          <div><strong>PATIENT ID</strong><span>: {patient.patientId}</span></div>
          <div><strong>BILL NO</strong><span>: {bill.billNumber}</span></div>
          <div><strong>PATIENT NAME</strong><span>: {patient.fullName.toUpperCase()}</span></div>
          <div><strong>BILL DATE</strong><span>: {formatDateTime(bill.createdAt)}</span></div>
          <div><strong>AGE/SEX</strong><span>: {patient.age ?? "—"} years / {formatGender(patient.gender)}</span></div>
          <div><strong>MOBILE</strong><span>: {patient.mobile}</span></div>
          <div><strong>REFER BY</strong><span>: {bill.doctorName ?? "Self"}</span></div>
        </div>
        <table className="mt-3"><thead><tr><th className="w-8 text-left">SNo</th><th className="text-left">INVESTIGATIONS</th><th className="w-24 text-right">AMOUNT</th></tr></thead>
          <tbody>{bill.items.map((item,index) => <tr key={item.testId}><td>{index+1}</td><td>{item.testName}{item.quantity !== 1 ? ` × ${item.quantity}` : ""}</td><td className="text-right">{formatMoney(item.total)}</td></tr>)}</tbody>
        </table>
        <div className="grid grid-cols-2 border border-t-0 border-black p-1">
          <div><p>{rupeesInWords(bill.paidAmount)}</p><p>MODE OF PAYMENT : {bill.paymentMode.replaceAll("_"," ").toUpperCase()}</p>{bill.displayComments && <p>{bill.displayComments}</p>}</div>
          <dl className="grid grid-cols-2 text-right">
            <dt>TOTAL AMOUNT :</dt><dd>{formatMoney(bill.totalAmount)}</dd>
            {bill.discountAmount > 0 && <><dt>DISCOUNT :</dt><dd>{formatMoney(bill.discountAmount)}</dd></>}
            <dt>NET AMOUNT :</dt><dd>{formatMoney(bill.netAmount)}</dd>
            <dt>PAID AMOUNT :</dt><dd>{formatMoney(bill.paidAmount)}</dd>
            <dt>BALANCE AMOUNT :</dt><dd>{formatMoney(bill.dueAmount)}</dd>
          </dl>
        </div>
        <footer><strong>PRINTED BY : {printedBy}</strong><strong>AUTHORISED SIGNATURE</strong></footer>
      </article>
    </div>);
}
