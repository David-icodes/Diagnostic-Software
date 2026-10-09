"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { whatsappAttachmentReady } from "@/lib/whatsapp-readiness";
import { APPROVED_WHATSAPP_FOOTER, whatsappPreview } from "@/lib/whatsapp-preview";
import { LIS_WHATSAPP_TEMPLATES, fetchLisDelivery, reviewLisWhatsApp, sendLisWhatsApp, type LisWhatsAppInput, type LisWhatsAppTemplate } from "@/services/whatsapp-lis";

export function LisSendDialog({ input, onClose, onLegacyReportReady }: { input: Omit<LisWhatsAppInput, "templateName">; onClose: () => void; onLegacyReportReady?: () => void }) {
  const [template, setTemplate] = useState<LisWhatsAppTemplate>("lab_report_ready");
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const retryRef = useRef(false);
  const statusStartedAt = useRef(0);
  const [sentMetaId, setSentMetaId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["whatsapp-review", input, template], queryFn: () => reviewLisWhatsApp({ ...input, templateName: template }),
    retry: false, gcTime: 0, staleTime: Infinity, refetchOnWindowFocus: false });
  const delivery = useQuery({ queryKey: ["whatsapp-delivery", input.billId, sentMetaId],
    queryFn: () => fetchLisDelivery(input.billId), retry: false,
    refetchInterval: (state) => {
      const current = state.state.data?.find((row) => row.metaMessageId === sentMetaId);
      return sentMetaId && Date.now() - statusStartedAt.current < 5 * 60 * 1000 &&
        !["read", "failed"].includes(current?.status ?? "") ? 5000 : false;
    } });
  const review = query.isError ? undefined : query.data;
  const attachmentReady = whatsappAttachmentReady(template, review);
  return <Dialog open size="lg" title="Send WhatsApp" description="Review the selected patient, bill and attachment before sending."
    onOpenChange={(open) => { if (!open && !sendingRef.current) onClose(); }}>
    <div className="space-y-3 text-sm">
      <label className="block">Selected WhatsApp Template
        <Select aria-label="WhatsApp template" value={template} disabled={sending || Boolean(message)} onChange={(event) => { setTemplate(event.target.value as LisWhatsAppTemplate); setError(null); }}>
          {Object.entries(LIS_WHATSAPP_TEMPLATES).map(([name, label]) => <option key={name} value={name}>{label}</option>)}
        </Select>
      </label>
      <p className="text-xs text-muted-foreground">Meta template: {template}</p>
      {onLegacyReportReady && <Button variant="outline" disabled={sending || Boolean(message)} onClick={onLegacyReportReady}>Existing report_ready workflow</Button>}
      <label className="block">WhatsApp recipient
        <Input aria-label="WhatsApp recipient mobile number" type="tel" readOnly value={review?.mobile ?? "+91"} />
      </label>
      <p className="text-xs text-muted-foreground">India (+91) is the default for local numbers. Existing international numbers retain their country code. The patient record is unchanged.</p>
      {query.isPending && <p role="status">Preparing the patient information and actual document…</p>}
      {query.isError && <div className="space-y-2"><p role="alert">{query.error.message}</p>
        <Button variant="outline" disabled={query.isFetching || sending} onClick={async () => { if (retryRef.current || sendingRef.current) return; retryRef.current = true; try { await query.refetch(); } finally { retryRef.current = false; } }}>{query.isFetching ? "Preparing…" : "Retry document preparation"}</Button></div>}
      {review && <>
        <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 break-words">
          <dt>Patient Name</dt><dd>{review.patientName}</dd>
          <dt>Patient ID</dt><dd>{review.patientCode}</dd>
          <dt>Bill Number</dt><dd>{review.billNumber}</dd>
          <dt>Bill Date</dt><dd>{review.billDate}</dd>
          <dt>Language</dt><dd>{review.languageCode ?? "Not configured"}</dd>
        </dl>
        <label className="block">Centre
          <Select aria-label="WhatsApp centre" defaultValue="deployment" disabled={sending || Boolean(message)}>
            <option value="deployment">{review.centreName}</option>
          </Select>
        </label>
        <section className="rounded-md border p-3" aria-label="Template variable preview">
          <p className="mb-2 font-medium">Message/template preview</p>
          <p className="mb-2 text-xs text-muted-foreground">Approved Meta wording verified on 9 October 2026. Meta controls the delivered template.</p>
          <p className="mb-3 whitespace-pre-wrap">{whatsappPreview(template, review.variables)}</p>
          <p className="mb-2 text-xs text-muted-foreground">Footer: {APPROVED_WHATSAPP_FOOTER}</p>
          <p className="mb-1 text-xs text-muted-foreground">Template values in order:</p>
          <ol className="space-y-1">{review.variables.map((value, index) => <li key={index}>{`{{${index + 1}}}`} {value}</li>)}</ol>
        </section>
        <p>Document: {review.attachment
          ? <a className="underline" download={review.attachment.filename} href={`data:application/pdf;base64,${review.attachment.base64}`}>{review.attachment.filename} — review PDF</a>
          : "No PDF attachment"}</p>
        {review.configurationError && <p role="alert">{review.configurationError}</p>}
      </>}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      <section aria-label="WhatsApp delivery status" className="space-y-2 rounded-md border p-3">
        <p className="font-medium">Recent delivery status</p>
        {delivery.isPending && <p>Loading delivery status…</p>}
        {delivery.isError && <p role="alert">Delivery status could not be checked. Acceptance does not confirm delivery.</p>}
        {delivery.data?.length === 0 && <p>No recorded messages for this bill.</p>}
        {delivery.data?.map((row) => <div key={row.metaMessageId} className="border-t pt-2 text-xs">
          <p>{row.templateName} · {row.languageCode ?? "—"} · {row.workflow} · <strong>{row.status}</strong></p>
          <p role={row.status === "failed" ? "alert" : "status"}>{row.message}</p>
          <p className="break-all text-muted-foreground">Message ID: {row.metaMessageId}</p>
        </div>)}
        <Button variant="outline" disabled={delivery.isFetching} onClick={() => { void delivery.refetch(); }}>Refresh delivery status</Button>
      </section>
      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={sending} onClick={onClose}>Close</Button>
        <Button disabled={!review || !attachmentReady || query.isFetching || Boolean(review.configurationError) || sending || Boolean(message) || Boolean(error)} onClick={async () => {
          if (!review || !attachmentReady || query.isFetching || review.configurationError || sendingRef.current) return;
          sendingRef.current = true; setSending(true); setError(null);
          try { const result = await sendLisWhatsApp(review.reviewId); statusStartedAt.current = Date.now(); setSentMetaId(result.metaMessageId); setMessage(`Message accepted by Meta. Message ID: ${result.metaMessageId}. Delivery is confirmed by the WhatsApp webhook.`); }
          catch (failure) { setError(failure instanceof Error ? failure.message : "WhatsApp send failed"); }
          finally { sendingRef.current = false; setSending(false); }
        }}>{sending ? "Sending…" : "Submit / Send"}</Button>
      </div>
    </div>
  </Dialog>;
}
