import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SITE_BASE_URL, apiRequest, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { DeployResponse, DeployStatus } from "@/lib/types";
import { FieldLabel, InlineError, PageHeader, Panel } from "../primitives";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Rocket,
} from "lucide-react";

export function DeployTab() {
  const { token } = useAuth();
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [last, setLast] = useState<DeployResponse | null>(null);

  const status = useQuery({
    queryKey: ["deploy-status"],
    queryFn: () => apiRequest<DeployStatus>("/deploy/status", { token: token! }),
    enabled: Boolean(token),
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "queued" || s === "in_progress" ? 5000 : false;
    },
  });

  const deploy = useMutation({
    mutationFn: () =>
      apiRequest<DeployResponse>("/deploy", {
        method: "POST",
        token: token!,
        body: { message: message.trim() || "Update storefront content" },
      }),
    onSuccess: (res) => {
      setLast(res ?? null);
      setConfirming(false);
      setFormError(null);
      setMessage("");
      toast.success("Publish started", {
        description: "The live site updates once the build finishes.",
      });
      void status.refetch();
    },
    onError: (err) => {
      setFormError(errorMessage(err));
      setConfirming(false);
    },
  });

  const state = status.data?.status;
  const running = state === "queued" || state === "in_progress";
  const failed = status.data?.conclusion === "failure";
  const succeeded = status.data?.conclusion === "success";

  return (
    <div>
      <PageHeader
        title="Deploy"
        description="Publish your saved changes to the live storefront. Each publish is a commit followed by an automatic build."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel>
          <InlineError message={formError} />

          <div className="mt-1">
            <FieldLabel htmlFor="deploy-message">Publish note (optional)</FieldLabel>
            <Textarea
              id="deploy-message"
              rows={3}
              placeholder="Added ISO 9001 starter pack pricing"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <p className="mt-1.5 text-xs text-slate">
              This note is stored with the change so you can recognise it in the audit log.
            </p>
          </div>

          {confirming ? (
            <div className="mt-4 border border-coral-border bg-coral-pale p-4">
              <p className="text-sm font-semibold text-charcoal">
                Publish all saved changes to the live site?
              </p>
              <p className="mt-1 text-sm text-slate">
                Visitors will see the new content as soon as the build finishes.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => deploy.mutate()} disabled={deploy.isPending}>
                  {deploy.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Rocket className="size-4" aria-hidden />
                  )}
                  {deploy.isPending ? "Publishing…" : "Yes, publish now"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setConfirming(false)}
                  disabled={deploy.isPending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button className="mt-4" onClick={() => setConfirming(true)} disabled={deploy.isPending}>
              <Rocket className="size-4" aria-hidden />
              Publish to live site
            </Button>
          )}

          {last ? (
            <div className="mt-5 border-t border-border pt-4 text-sm">
              <p className="font-semibold text-charcoal">Last publish request</p>
              <p className="mt-1 text-slate">
                {last.message ?? "Change committed."}
                {last.commit_sha ? ` (${last.commit_sha.slice(0, 7)})` : ""}
              </p>
              {last.commit_url ? (
                <a
                  href={last.commit_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-coral-dark hover:underline"
                >
                  View the change <ExternalLink className="size-3.5" aria-hidden />
                </a>
              ) : null}
            </div>
          ) : null}
        </Panel>

        <Panel>
          <div className="flex items-center justify-between">
            <p className="label-caps">Build status</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void status.refetch()}
              disabled={status.isFetching}
              aria-label="Refresh build status"
            >
              <RefreshCw
                className={status.isFetching ? "size-4 animate-spin" : "size-4"}
                aria-hidden
              />
            </Button>
          </div>

          {status.isError ? (
            <p className="mt-3 text-sm text-slate">Build status is unavailable right now.</p>
          ) : (
            <div className="mt-3 space-y-2 text-sm">
              <p className="flex items-center gap-2 font-semibold text-charcoal">
                {running ? (
                  <Loader2 className="size-4 animate-spin text-coral-dark" aria-hidden />
                ) : failed ? (
                  <AlertTriangle className="size-4 text-destructive" aria-hidden />
                ) : succeeded ? (
                  <CheckCircle2 className="size-4 text-coral-dark" aria-hidden />
                ) : null}
                {running
                  ? "Building now"
                  : failed
                    ? "Last build failed"
                    : succeeded
                      ? "Live and up to date"
                      : (state ?? "No builds yet")}
              </p>
              {status.data?.updated_at ? (
                <p className="text-slate">
                  Updated {new Date(status.data.updated_at).toLocaleString()}
                </p>
              ) : null}
              {status.data?.html_url ? (
                <a
                  href={status.data.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-coral-dark hover:underline"
                >
                  Open build log <ExternalLink className="size-3.5" aria-hidden />
                </a>
              ) : null}
            </div>
          )}

          <a
            href={SITE_BASE_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center gap-1 border-t border-border pt-4 text-sm font-semibold text-charcoal hover:text-coral-dark"
          >
            Visit the live site <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </Panel>
      </div>
    </div>
  );
}
