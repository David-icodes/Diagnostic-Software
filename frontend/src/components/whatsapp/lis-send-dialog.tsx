"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { whatsappAttachmentReady } from "@/lib/whatsapp-readiness";
import { LIS_WHATSAPP_TEMPLATES, reviewLisWhatsApp, sendLisWhatsApp, type LisWhatsAppInput, type LisWhatsAppTemplate } from "@/services/whatsapp-lis";

export function LisSendDialog({ input, onClose, onLegacyReportReady }: { input: Omit<LisWhatsAppInput, "templateName">; onClose: () => void; onLegacyReportReady?: () => void }) {
  const [template, setTemplate] = useState<LisWhatsAppTemplate>("lab_report_ready");
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const retryRef = useRef(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["whatsapp-review", input, template], queryFn: () => reviewLisWhatsApp({ ...input, templateName: template }),
    retry: false, gcTime: 0, staleTime: Infinity, refetchOnWindowFocus: false });
  const review = query.isError ? undefined : query.data;
  const attachmentReady = whatsappAttachmentReady(template, review);
  if (message || error) return <Dialog open centered hideCloseButton title={message ? "WhatsApp message submitted successfully." : "WhatsApp message could not be submitted"} onOpenChange={(open) => { if (!open) onClose(); }}>
    {error && <p role="alert" className="mb-3 text-sm">{error}</p>}
    <div className="flex justify-center"><Button onClick={onClose}>Close</Button></div>
  </Dialog>;
  return <Dialog open centered title="Send WhatsApp" onOpenChange={(open) => { if (!open && !sendingRef.current) onClose(); }}>
    <div className="space-y-3 text-sm">
      <label className="block">Selected WhatsApp Template
        <Select aria-label="WhatsApp template" value={template} disabled={sending} onChange={(event) => {
          if (event.target.value === "report_ready") { onLegacyReportReady?.(); return; }
          setTemplate(event.target.value as LisWhatsAppTemplate);
        }}>
          {Object.entries(LIS_WHATSAPP_TEMPLATES).map(([name, label]) => <option key={name} value={name}>{label}</option>)}
          {onLegacyReportReady && <option value="report_ready">Existing report_ready workflow</option>}
        </Select>
      </label>
      {query.isPending && <p role="status">Preparing patient information and document…</p>}
      {query.isError && <div className="space-y-2"><p role="alert">{query.error.message}</p>
        <Button variant="outline" disabled={query.isFetching || sending} onClick={async () => { if (retryRef.current || sendingRef.current) return; retryRef.current = true; try { await query.refetch(); } finally { retryRef.current = false; } }}>{query.isFetching ? "Preparing…" : "Retry"}</Button></div>}
      {review && <>
        <section aria-label="Selected patient" className="rounded border px-3 py-2">
          <p className="font-medium">{review.patientName}</p>
          <p className="text-xs text-muted-foreground">{review.patientCode} · {review.billNumber}</p>
          <p aria-label="WhatsApp recipient mobile number">{review.mobile || "+91"}</p>
        </section>
        {review.configurationError && <p role="alert">{review.configurationError}</p>}
      </>}
      <div className="flex justify-end">
        <Button disabled={!review || !attachmentReady || query.isFetching || Boolean(review.configurationError) || sending} onClick={async () => {
          if (!review || !attachmentReady || query.isFetching || review.configurationError || sendingRef.current) return;
          sendingRef.current = true; setSending(true);
          try { await sendLisWhatsApp(review.reviewId); setMessage("submitted"); }
          catch (failure) { setError(failure instanceof Error ? failure.message : "WhatsApp send failed"); }
          finally { sendingRef.current = false; setSending(false); }
        }}>{sending ? "Sending…" : "Send"}</Button>
      </div>
    </div>
  </Dialog>;
}
