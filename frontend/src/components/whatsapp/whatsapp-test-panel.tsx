"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { sendWhatsAppTestMessage } from "@/services/whatsapp";

/**
 * TEMPORARY admin-only panel for exercising the outbound WhatsApp Cloud API
 * endpoint without DevTools. Standalone by design: it touches no billing,
 * report, appointment or patient data, and stores nothing.
 *
 * Delete this component together with `app/temp/whatsapp-test` and
 * `services/whatsapp.ts` once the endpoint has been verified.
 */
export function WhatsAppTestPanel() {
  const { user } = useAuth();
  const [to, setTo] = useState("");
  const [templateName, setTemplateName] = useState("test_message");
  const [languageCode, setLanguageCode] = useState("en");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const [result, setResult] = useState<{
    metaMessageId: string;
    waId: string;
    templateName: string;
    languageCode: string;
  } | null>(null);

  const isAdmin = user?.role === "admin";

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setErrorCode(null);
    setResult(null);

    const digits = to.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Enter a destination number with at least 10 digits.");
      setErrorCode(null);
      return;
    }

    setIsSending(true);
    try {
      const response = await sendWhatsAppTestMessage({
        to: digits,
        templateName: templateName.trim(),
        languageCode: languageCode.trim(),
      });
      setResult(response);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "The test message could not be sent.",
      );
      setErrorCode(submitError instanceof ApiError ? submitError.status : null);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded bg-primary text-primary-foreground">
          <Send className="size-4" />
        </span>
        <h1 className="text-lg font-semibold text-slate-800">
          WhatsApp Send Test
        </h1>
        <span className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700">
          temporary
        </span>
      </div>

      <Card className="max-w-xl border-border shadow-sm">
        <CardContent className="p-4">
          {!isAdmin && (
            <div
              role="status"
              className="mb-3 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
            >
              This test is restricted to administrators. Signed in as{" "}
              <span className="font-medium">
                {user?.role ?? "unknown"}
              </span>
              .
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mb-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>
                {error}
                {errorCode !== null && (
                  <span className="ml-1 font-mono">(HTTP {errorCode})</span>
                )}
              </span>
            </div>
          )}

          {result && (
            <div
              role="status"
              className="mb-3 space-y-1 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
            >
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="size-4 shrink-0" />
                Template message accepted by Meta.
              </div>
              <p className="font-mono text-xs">
                message id: {result.metaMessageId}
              </p>
              <p className="font-mono text-xs">waId: {result.waId}</p>
              <p className="font-mono text-xs">
                {result.templateName} / {result.languageCode}
              </p>
            </div>
          )}

          <form onSubmit={onSubmit} noValidate className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="wa-to">Destination number</Label>
              <Input
                id="wa-to"
                type="text"
                inputMode="tel"
                autoComplete="off"

                className="h-8"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                disabled={!isAdmin || isSending}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wa-template">Template name</Label>
              <Input
                id="wa-template"
                type="text"
                autoComplete="off"
                className="h-8"
                value={templateName}
                onChange={(event) => setTemplateName(event.target.value)}
                disabled={!isAdmin || isSending}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wa-language">Language code</Label>
              <Input
                id="wa-language"
                type="text"
                autoComplete="off"
                className="h-8"
                value={languageCode}
                onChange={(event) => setLanguageCode(event.target.value)}
                disabled={!isAdmin || isSending}
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button
                type="submit"
                size="sm"
                disabled={!isAdmin || isSending}
              >
                {isSending && <Loader2 className="size-4 animate-spin" />}
                Send test message
              </Button>
            </div>
          </form>

          <p className="mt-3 text-xs text-muted-foreground">
            Sends one template message through the server-side Cloud API token.
            Nothing is written to the database.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default WhatsAppTestPanel;
