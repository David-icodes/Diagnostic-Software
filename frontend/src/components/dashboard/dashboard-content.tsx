"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock3,
  FilePlus2,
  FlaskConical,
  HandCoins,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ActionCard } from "@/components/dashboard/action-card";
import { StatisticCard } from "@/components/dashboard/statistic-card";
import { TodayBillsPanel } from "@/components/dashboard/today-bills-panel";
import { DueBillsPanel } from "@/components/dashboard/due-bills-panel";
import { ErrorState } from "@/components/common/error-state";
import {
  fetchDashboardSummary,
  fetchDueBills,
  fetchTodayBills,
} from "@/services/dashboard";

function formatToday(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${now.getFullYear()}`;
}

function StatisticCardSkeleton() {
  return (
    <Card className="border-border shadow-sm">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="space-y-2">
          <div className="h-2.5 w-24 animate-pulse rounded bg-muted" />
          <div className="h-7 w-10 animate-pulse rounded bg-muted" />
          <div className="h-2.5 w-20 animate-pulse rounded bg-muted" />
        </div>
        <div className="size-10 shrink-0 animate-pulse rounded-lg bg-muted" />
      </CardContent>
    </Card>
  );
}

export function DashboardContent() {
  const summaryQuery = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: fetchDashboardSummary,
  });

  const billsQuery = useQuery({
    queryKey: ["dashboard", "today-bills"],
    queryFn: fetchTodayBills,
  });

  const dueQuery = useQuery({
    queryKey: ["dashboard", "due-bills"],
    queryFn: fetchDueBills,
  });

  const date = summaryQuery.data?.date ?? formatToday();

  const statCards = (() => {
    if (summaryQuery.isLoading) {
      return (
        <>
          <StatisticCardSkeleton />
          <StatisticCardSkeleton />
          <StatisticCardSkeleton />
        </>
      );
    }

    if (summaryQuery.error) {
      return (
        <ErrorState
          className="col-span-1 justify-self-center sm:col-span-2 xl:col-span-3"
          message={summaryQuery.error.message}
          onRetry={() => void summaryQuery.refetch()}
        />
      );
    }

    const summary = summaryQuery.data;
    if (!summary) {
      return null;
    }

    return (
      <>
        <StatisticCard
          title="No of Lab Bills"
          value={summary.labBills}
          date={date}
          icon={FlaskConical}
          tone="blue"
        />
        <StatisticCard
          title="Completed Tests"
          value={summary.completedTests}
          date={date}
          icon={CheckCircle2}
          tone="green"
        />
        <StatisticCard
          title="Pending Tests"
          value={summary.pendingTests}
          date={date}
          icon={Clock3}
          tone="amber"
        />
      </>
    );
  })();

  return (
    <div className="space-y-5">
      <section
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5"
        aria-label="Dashboard summary"
      >
        <ActionCard title="New OSP Bill" icon={FilePlus2} />
        <ActionCard title="Due Collection" icon={HandCoins} />
        {statCards}
      </section>

      <section
        className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2"
        aria-label="Today's activity"
      >
        <TodayBillsPanel
          rows={billsQuery.data ?? []}
          isLoading={billsQuery.isLoading}
          isRefreshing={billsQuery.isFetching}
          error={billsQuery.error}
          onRefresh={() => void billsQuery.refetch()}
          onRetry={() => void billsQuery.refetch()}
        />
        <DueBillsPanel
          rows={dueQuery.data ?? []}
          isLoading={dueQuery.isLoading}
          isRefreshing={dueQuery.isFetching}
          error={dueQuery.error}
          onRefresh={() => void dueQuery.refetch()}
          onRetry={() => void dueQuery.refetch()}
        />
      </section>
    </div>
  );
}