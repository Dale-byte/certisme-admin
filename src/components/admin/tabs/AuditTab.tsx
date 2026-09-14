import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { apiRequest, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { AuditEntry } from "@/lib/types";
import { EmptyState, InlineError, Loading, PageHeader, Panel } from "../primitives";
import { ExternalLink, RefreshCw } from "lucide-react";

export function AuditTab() {
  const { token } = useAuth();

  const log = useQuery({
    queryKey: ["audit"],
    queryFn: () => apiRequest<AuditEntry[]>("/audit", { token: token! }),
    enabled: Boolean(token),
  });

  return (
    <div>
      <PageHeader
        title="Audit Log"
        description="Every change made through this dashboard, newest first."
        actions={
          <Button
            variant="outline"
            onClick={() => void log.refetch()}
            disabled={log.isFetching}
          >
            <RefreshCw
              className={log.isFetching ? "size-4 animate-spin" : "size-4"}
              aria-hidden
            />
            Refresh
          </Button>
        }
      />

      {log.isLoading ? (
        <Loading label="Loading history…" />
      ) : log.isError ? (
        <InlineError message={errorMessage(log.error)} />
      ) : !log.data?.length ? (
        <EmptyState
          title="No changes recorded yet"
          hint="Once you save and publish content, each change appears here."
        />
      ) : (
        <Panel className="p-0">
          <ul className="divide-y divide-border">
            {log.data.map((entry) => (
              <li key={entry.sha} className="flex flex-col gap-1 px-5 py-4 sm:px-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-charcoal">{entry.message}</p>
                  <p className="text-xs text-slate">
                    {entry.date ? new Date(entry.date).toLocaleString() : "—"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate">
                  <span>{entry.author || "Unknown"}</span>
                  <span className="font-mono">{entry.sha?.slice(0, 7)}</span>
                  {entry.url ? (
                    <a
                      href={entry.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-coral-dark hover:underline"
                    >
                      View details <ExternalLink className="size-3" aria-hidden />
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
