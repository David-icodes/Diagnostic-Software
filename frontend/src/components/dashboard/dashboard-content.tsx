"use client";

import { useQuery } from "@tanstack/react-query";
import { FlaskConical, ReceiptIndianRupee, SquareCheck, SquareMinus, UserRoundPlus } from "lucide-react";
import { ActionCard } from "@/components/dashboard/action-card";
import { DashboardFooter } from "@/components/dashboard/dashboard-footer";
import { DueBillsPanel } from "@/components/dashboard/due-bills-panel";
import { StatisticCard } from "@/components/dashboard/statistic-card";
import { TodayBillsPanel } from "@/components/dashboard/today-bills-panel";
import { ErrorState } from "@/components/common/error-state";
import { Card } from "@/components/ui/card";
import { queryKeys } from "@/lib/query-keys";
import { fetchDashboardSummary } from "@/services/dashboard";

function MetricSkeleton() {
  return (
    <Card className="h-[130px] p-0 shadow-sm" aria-hidden>
      <div className="flex h-full flex-col justify-between px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            <div className="h-7 w-16 animate-pulse rounded bg-muted" />
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          </div>
          <div className="size-10 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="h-3 w-32 animate-pulse rounded bg-muted" />
      </div>
    </Card>
  );
}

export function DashboardContent() {
  const summary = useQuery({
    queryKey: [...queryKeys.dashboard, "summary"],
    queryFn: fetchDashboardSummary,
  });

  const isLoading = summary.isLoading;
  const isError = summary.isError;

  return (
    <div className="lis-dashboard flex min-h-full flex-col gap-3">
      <section
        aria-label="Daily summary"
        className="lis-dashboard-summary grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(150px,0.48fr)_minmax(150px,0.48fr)_minmax(260px,1fr)_minmax(260px,1fr)_minmax(260px,1fr)]"
      >
        <ActionCard
          title="New OSP Bill"
          icon={UserRoundPlus}
          href="/billing/osp/new"
        />
        <ActionCard
          title="Due Collection"
          icon={ReceiptIndianRupee}
          href="/laboratory/billing/collect-dues"
        />
        {isError ? (
          <ErrorState
            className="sm:col-span-2 xl:col-span-3"
            message="Could not load the dashboard summary."
            onRetry={() => void summary.refetch()}
          />
        ) : isLoading ? (
          <>
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
          </>
        ) : (
          <>
            <StatisticCard
              title="No of Lab Bills"
              value={summary.data?.labBills ?? 0}
              hint={summary.data?.date || undefined}
              icon={FlaskConical}
              iconClassName="text-[#7aa244]"
            />
            <StatisticCard
              title="Completed Tests"
              value={summary.data?.completedTests ?? 0}
              hint={`Completed bills · ${summary.data?.date ?? ""}`}
              icon={SquareCheck}
              iconClassName="text-[#337ab7]"
            />
            <StatisticCard
              title="Pending Tests"
              value={summary.data?.pendingTests ?? 0}
              hint={`Pending bills · ${summary.data?.date ?? ""}`}
              icon={SquareMinus}
              iconClassName="text-[#c9302c]"
            />
          </>
        )}
      </section>

      <section
        aria-label="Daily bills"
        className="lis-dashboard-bills grid grid-cols-1 gap-2 xl:grid-cols-2"
      >
        <TodayBillsPanel />
        <DueBillsPanel />
      </section>

      <DashboardFooter />
    </div>
  );
}

export default function DashboardPage() {
  return <DashboardContent />;
}
