import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { SiteSettings } from "@/lib/types";
import { FieldLabel, InlineError, Loading, PageHeader, Panel } from "../primitives";
import { CheckCircle2, Circle, Save } from "lucide-react";

const blank: SiteSettings = { site_name: "", site_url: "", contact_email: "" };

export function SettingsTab() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<SiteSettings>(blank);
  const [formError, setFormError] = useState<string | null>(null);

  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiRequest<SiteSettings>("/settings", { token: token! }),
    enabled: Boolean(token),
  });

  useEffect(() => {
    if (settings.data) setForm({ ...blank, ...settings.data });
  }, [settings.data]);

  const save = useMutation({
    mutationFn: (next: SiteSettings) =>
      apiRequest<SiteSettings>("/settings", {
        method: "PUT",
        token: token!,
        body: {
          site_name: next.site_name.trim(),
          site_url: next.site_url.trim(),
          contact_email: next.contact_email.trim(),
        },
      }),
    onSuccess: (data) => {
      if (data) qc.setQueryData(["settings"], data);
      else void qc.invalidateQueries({ queryKey: ["settings"] });
      setFormError(null);
      toast.success("Settings saved", {
        description: "Publish on the Deploy tab to push them live.",
      });
    },
    onError: (err) => setFormError(errorMessage(err)),
  });

  return (
    <div>
      <PageHeader
        title="Site Settings"
        description="Public details used across the storefront. Payment credentials live only on the API — this screen shows whether they are set."
      />

      {settings.isLoading ? (
        <Loading label="Loading settings…" />
      ) : settings.isError ? (
        <InlineError message={errorMessage(settings.error)} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Panel>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.site_name.trim()) {
                  setFormError("Site name is required.");
                  return;
                }
                if (!/^\S+@\S+\.\S+$/.test(form.contact_email.trim())) {
                  setFormError("Enter a valid contact email address.");
                  return;
                }
                save.mutate(form);
              }}
            >
              <InlineError message={formError} />

              <div>
                <FieldLabel htmlFor="site_name">Site name</FieldLabel>
                <Input
                  id="site_name"
                  value={form.site_name}
                  onChange={(e) => setForm((f) => ({ ...f, site_name: e.target.value }))}
                />
              </div>

              <div>
                <FieldLabel htmlFor="site_url">Site URL</FieldLabel>
                <Input
                  id="site_url"
                  inputMode="url"
                  placeholder="https://certisme.co.za"
                  value={form.site_url}
                  onChange={(e) => setForm((f) => ({ ...f, site_url: e.target.value }))}
                />
              </div>

              <div>
                <FieldLabel htmlFor="contact_email">Contact email</FieldLabel>
                <Input
                  id="contact_email"
                  type="email"
                  value={form.contact_email}
                  onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
                />
              </div>

              <Button type="submit" disabled={save.isPending}>
                <Save className="size-4" aria-hidden />
                {save.isPending ? "Saving…" : "Save settings"}
              </Button>
            </form>
          </Panel>

          <Panel>
            <p className="label-caps mb-3">Payment credentials</p>
            <ul className="space-y-3 text-sm">
              <CredentialRow label="Merchant ID" ok={Boolean(settings.data?.merchant_id_set)} />
              <CredentialRow label="Merchant key" ok={Boolean(settings.data?.merchant_key_set)} />
            </ul>
            <p className="mt-4 text-xs text-slate">
              These values are stored securely on the API and are never shown or edited here.
            </p>
          </Panel>
        </div>
      )}
    </div>
  );
}

function CredentialRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <li className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="size-4 text-coral-dark" aria-hidden />
      ) : (
        <Circle className="size-4 text-slate/50" aria-hidden />
      )}
      <span className="text-charcoal">{label}</span>
      <span className={ok ? "ml-auto text-xs text-coral-dark" : "ml-auto text-xs text-slate"}>
        {ok ? "Set" : "Not set"}
      </span>
    </li>
  );
}
