"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/empty-state";
import { fetchClients } from "@/services/billing";
import type { LabClient } from "@/types/billing";

interface ClientPickerProps {
  selected: LabClient | null;
  onSelect: (client: LabClient) => void;
}

export function ClientPicker({ selected, onSelect }: ClientPickerProps) {
  const [open, setOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const handleOpen = () => {
    setSearchInput("");
    setSearch("");
    setOpen(true);
  };

  const searchQuery = useQuery({
    queryKey: ["lab-clients", "billing-search", search],
    queryFn: () => fetchClients({ search, limit: 25 }),
    enabled: open,
    placeholderData: (previous) => previous,
  });

  const rows = searchQuery.data ?? [];

  return (
    <>
      <Card className="border-border shadow-sm">
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-1">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Building2 className="size-3.5" />
                Billing Client
                {!selected && <span className="text-destructive">*</span>}
              </p>
              {selected ? (
                <>
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {selected.name}
                    <Badge variant="secondary" className="ml-2">
                      {selected.clientCode}
                    </Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selected.city || selected.contactPerson || "—"}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select the client this vendor bill belongs to
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpen}
            >
              {selected ? "Change" : "Select Client"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Select Client"
        description="Search registered vendors and clients"
        size="lg"
      >
        <div className="space-y-3">
          <Input
            type="search"
            placeholder="Search by name, code or city..."
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className="h-8"
            autoFocus
            aria-label="Search clients"
          />
          {searchQuery.isLoading ? (
            <div className="flex flex-col gap-1.5" aria-busy>
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-8 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState message="No clients match your search" />
          ) : (
            <ul className="divide-y divide-border/70 rounded-lg border border-border">
              {rows.map((client) => (
                <li key={client.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-2.5 py-1.5 text-left transition-colors hover:bg-muted"
                    onClick={() => {
                      onSelect(client);
                      setOpen(false);
                    }}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium text-slate-800">
                        {client.name}
                        <Badge variant="outline" className="ml-2">
                          {client.clientCode}
                        </Badge>
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {[client.contactPerson, client.city, client.mobile]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </span>
                    </span>
                    <span className="text-[11px] font-medium text-primary">
                      Select
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Dialog>
    </>
  );
}