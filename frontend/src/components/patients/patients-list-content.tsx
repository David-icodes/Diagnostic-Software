"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BillsTable, type ColumnDef } from "@/components/dashboard/bills-table";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { useAuth } from "@/hooks/use-auth";
import { fetchPatients } from "@/services/patients";
import { formatGender } from "@/lib/utils";
import type { Patient } from "@/types/patient";

const PAGE_SIZE = 20;

export function PatientsListContent() {
  const { isAuthenticated } = useAuth();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const patientsQuery = useQuery({
    queryKey: ["patients", "list", { page, search }],
    queryFn: () => fetchPatients({ page, limit: PAGE_SIZE, search }),
    enabled: isAuthenticated,
    placeholderData: (previous) => previous,
  });

  const { data } = patientsQuery;
  const pagination = data?.pagination;
  const rows = data?.data ?? [];

  const columns: ColumnDef<Patient>[] = [
    {
      key: "index",
      label: "#",
      align: "center",
      className: "w-10",
      render: (_row, index) => (page - 1) * PAGE_SIZE + index + 1,
    },
    {
      key: "patientId",
      label: "Patient ID",
      className: "w-[130px]",
      render: (row) => (
        <Link
          href={`/patients/${row.patientId}`}
          className="font-medium text-primary hover:underline"
        >
          {row.patientId}
        </Link>
      ),
    },
    {
      key: "fullName",
      label: "Patient Name",
      render: (row) => (
        <span className="font-medium text-slate-800">{row.fullName}</span>
      ),
    },
    {
      key: "gender",
      label: "Gender",
      className: "w-[90px]",
      render: (row) => formatGender(row.gender),
    },
    { key: "age", label: "Age", className: "w-[60px]", align: "center" },
    { key: "mobile", label: "Mobile", className: "w-[130px]" },
    { key: "city", label: "City", className: "w-[130px]" },
    {
      key: "actions",
      label: "",
      className: "w-[90px]",
      align: "right",
      render: (row) => (
        <Link
          href={`/patients/${row.patientId}`}
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-primary transition-colors hover:bg-muted"
        >
          View
        </Link>
      ),
    },
  ];

  const isLoading = patientsQuery.isLoading || patientsQuery.isPlaceholderData;

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-base font-medium text-slate-800">
            <Users className="size-5 text-primary" />
            Patients
          </h1>
          <p className="text-xs text-muted-foreground">
            Search, view and manage patient records
          </p>
        </div>
        <Button asChild>
          <Link href="/patients/new">
            <Plus />
            New Patient
          </Link>
        </Button>
      </header>

      <Card className="border-border shadow-sm">
        <CardHeader className="flex-row items-center justify-between gap-2 border-b border-border py-2">
          <CardTitle className="text-sm font-semibold text-slate-800">
            Patient Registry
            {pagination !== undefined && (
              <span className="ml-2 font-normal text-muted-foreground">
                {pagination.total} record{pagination.total === 1 ? "" : "s"}
              </span>
            )}
          </CardTitle>
          <Input
            type="search"
            placeholder="Search by ID, name or mobile..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="h-8 w-full max-w-xs"
            aria-label="Search patients"
          />
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col gap-1.5 p-3" aria-busy>
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-8 animate-pulse rounded bg-muted"
                />
              ))}
            </div>
          ) : patientsQuery.error ? (
            <ErrorState
              message={
                patientsQuery.error.message ||
                "Failed to load patients. Please try again."
              }
              onRetry={() => void patientsQuery.refetch()}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              message={
                search ? "No patients match your search" : "No patients yet"
              }
            />
          ) : (
            <BillsTable
              columns={columns}
              rows={rows}
              rowKey={(row) => row.id}
              maxHeightClass="max-h-[60vh]"
            />
          )}
        </CardContent>

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
            <p className="text-xs text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={pagination.page <= 1}
              >
                <ArrowLeft className="size-3.5" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPage((value) =>
                    Math.min(pagination.totalPages, value + 1),
                  )
                }
                disabled={pagination.page >= pagination.totalPages}
              >
                Next
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}