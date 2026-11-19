import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { SiteContent } from "@/lib/types";
import type { LighthouseReport } from "@/lib/types";
import { FieldLabel, InlineError, Loading, NativeSelect, PageHeader, Panel } from "../primitives";

const CAT_LABEL: Record<string, string> = {
  performance: "Performance",
  seo: "SEO",
  accessibility: "Accessibility",
  "best-practices": "Best practices",
};

function tone(score: number | null) {
  if (score === null) return "text-slate border-border";
  if (score >= 90) return "text-primary border-primary";
  if (score >= 50) return "text-brand-blue border-brand-blue";
  return "text-destructive border-destructive";
}

export function LighthouseTab() {
  const { token } = useAuth();
  const [path, setPath] = useState("/");
  const [strategy, setStrategy] = useState<"mobile" | "desktop">("mobile");

  const content = useQuery({
    queryKey: ["content"],
    queryFn: () => apiRequest<{ content: SiteContent }>("/content", { token: token! }),
    enabled: Boolean(token),
  });
  const live = content.data?.content;
  const pages = [
    ...(live?.pages ?? []).filter((p) => p.published).map((p) => ({ label: p.name, path: p.slug })),
    ...(live?.guides ?? []).map((g) => ({ label: `Guide: ${g.h1}`, path: `/guides/${g.id}` })),
    ...(live?.templates ?? []).map((t) => ({ label: `Template: ${t.h1}`, path: `/templates/${t.id}` })),
  ];

  const run = useMutation({
    mutationFn: () =>
      apiRequest<LighthouseReport>("/lighthouse", { token: token!, method: "POST", body: { path, strategy } }),
  });
  const r = run.data;

  return (
    <div>
      <PageHeader
        title="SEO & Speed"
        description="Google Lighthouse scores for your live storefront pages. Checks the published site, not drafts, and takes about 30 seconds."
      />
      <Panel className="mb-5 grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_160px_auto] sm:items-end">
        <div>
          <FieldLabel htmlFor="lh-path">Page</FieldLabel>
          {pages.length ? (
            <NativeSelect id="lh-path" value={path} onChange={(e) => setPath(e.target.value)}>
              {pages.map((p) => (
                <option key={p.path} value={p.path}>{p.label} ({p.path})</option>
              ))}
            </NativeSelect>
          ) : (
            <Input id="lh-path" value={path} onChange={(e) => setPath(e.target.value)} placeholder="/" />
          )}
        </div>
        <div>
          <FieldLabel htmlFor="lh-device">Device</FieldLabel>
          <NativeSelect id="lh-device" value={strategy} onChange={(e) => setStrategy(e.target.value as "mobile" | "desktop")}>
            <option value="mobile">Phone</option>
            <option value="desktop">Computer</option>
          </NativeSelect>
        </div>
        <Button onClick={() => run.mutate()} disabled={run.isPending}>
          <Gauge className="size-4" aria-hidden />
          {run.isPending ? "Checking…" : "Run check"}
        </Button>
      </Panel>

      {run.isPending ? <Loading label="Google is checking the page… this can take up to a minute." /> : null}
      {run.isError ? <InlineError message={errorMessage(run.error)} /> : null}

      {r && !run.isPending ? (
        <div className="space-y-5">
          <p className="text-sm text-slate">
            {r.url} · {r.strategy === "mobile" ? "Phone" : "Computer"} · {new Date(r.fetched_at).toLocaleString()}
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Object.entries(r.scores).map(([k, v]) => (
              <Panel key={k} className="flex flex-col items-center gap-2 p-4">
                <div className={`flex size-16 items-center justify-center rounded-full border-4 text-xl font-bold ${tone(v)}`}>
                  {v ?? "–"}
                </div>
                <p className="text-sm font-semibold text-charcoal">{CAT_LABEL[k]}</p>
              </Panel>
            ))}
          </div>
          {r.metrics.length ? (
            <Panel className="p-4">
              <h3 className="mb-3 font-semibold text-charcoal">Loading speed</h3>
              <dl className="grid gap-2 sm:grid-cols-2">
                {r.metrics.map((m) => (
                  <div key={m.id} className="flex justify-between gap-3 border-b border-border py-1.5 text-sm">
                    <dt className="text-slate">{m.title}</dt>
                    <dd className="font-medium text-charcoal">{m.value}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          ) : null}
          <Panel className="p-4">
            <h3 className="mb-3 font-semibold text-charcoal">What to improve ({r.issues.length})</h3>
            {r.issues.length === 0 ? (
              <p className="text-sm text-slate">Nothing flagged. Nice.</p>
            ) : (
              <ul className="divide-y divide-border">
                {r.issues.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-start justify-between gap-2 py-2 text-sm">
                    <span className="min-w-0 text-charcoal">{i.title}{i.savings ? <span className="text-slate"> — {i.savings}</span> : null}</span>
                    <span className="label-caps shrink-0 text-slate">{CAT_LABEL[i.category]}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
