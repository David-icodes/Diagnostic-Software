"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  hasOrganisationBranding,
  organisationBranding,
  organisationContactLines,
  type OrganisationBranding,
} from "@/config/organisation";

interface ReportPreviewProps {
  /** Title printed in the report header (e.g. "GP Patients Report"). */
  reportTitle: string;
  /** Applied filter summary, e.g. `From Date : …  |  Gender : Female`. */
  criteria?: string;
  /** Total matching records shown by the report. */
  total?: number;
  /** Unit word used with the total, e.g. "patients", "bills", "tests". */
  unitLabel?: string;
  /** Overridable so a report can be rendered with test branding. */
  branding?: OrganisationBranding;
  /** Extra read-only totals printed on the right of the report title. */
  trailing?: string;
  /** Report toolbar and table. */
  children: React.ReactNode;
  className?: string;
}

/**
 * The white "paper" area of a report: organisation header, printed report title,
 * applied criteria, record count, then the toolbar and table.
 *
 * Branding comes from `config/organisation` (public env vars). When nothing is
 * configured the header degrades to the report title, criteria and total — no
 * placeholder centre name, address or phone number is ever invented.
 */
export function ReportPreview({
  reportTitle,
  criteria,
  total,
  unitLabel = "records",
  branding = organisationBranding,
  trailing,
  children,
  className,
}: ReportPreviewProps) {
  const showBranding = hasOrganisationBranding(branding);
  const contact = organisationContactLines(branding);

  return (
    <section
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-card",
        className,
      )}
    >
      {showBranding && (
        <header className="lis-report-brand-header flex flex-wrap items-start justify-between gap-x-4 gap-y-1 border-b border-border/70 px-3 py-2">
          <div className="flex min-w-0 items-start gap-2.5">
            {branding.logo && (
              // A configured logo path is an arbitrary deployment asset, so the
              // optimiser is bypassed rather than allow-listing it.
              <Image
                src={branding.logo}
                alt={`${branding.name || "Organisation"} logo`}
                width={40}
                height={40}
                unoptimized
                className="lis-report-main-logo size-10 shrink-0 object-contain"
              />
            )}
            <div className="min-w-0 text-[11px] leading-tight text-muted-foreground">
              {branding.name && (
                <p className="lis-report-centre-name text-[13px] font-semibold text-slate-800">
                  {branding.name}
                </p>
              )}
              {branding.address && <p>{branding.address}</p>}
              {contact.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
        </header>
      )}

      <div className="flex items-start justify-between gap-3 border-b border-border/70 px-3 py-1.5">
        <div className="min-w-0 text-center">
          <h2 className="font-heading text-[15px] leading-tight font-semibold text-slate-800">
            {reportTitle}
          </h2>
          {criteria && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">{criteria}</p>
          )}
        </div>
        <div className="shrink-0 text-right text-[11px] leading-tight text-muted-foreground">
          {(
            <p>
              Total {unitLabel}: {total ?? 0}
            </p>
          )}
          {trailing && <p>{trailing}</p>}
        </div>
      </div>

      {children}
    </section>
  );
}
