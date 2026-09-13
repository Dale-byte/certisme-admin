import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Framework } from "@/lib/types";
import {
  EmptyState,
  FieldLabel,
  InlineError,
  Loading,
  PageHeader,
  Panel,
} from "../primitives";
import { Pencil, Plus, Trash2, X } from "lucide-react";

const empty: Framework = { id: "", name: "", full_name: "", description: "", color: "#0D9488" };

export function FrameworksTab() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<{ framework: Framework; isNew: boolean } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const frameworks = useQuery({
    queryKey: ["frameworks"],
    queryFn: () => apiRequest<Framework[]>("/frameworks", { token: token! }),
    enabled: Boolean(token),
  });

  const save = useMutation({
    mutationFn: ({ framework, isNew }: { framework: Framework; isNew: boolean }) =>
      isNew
        ? apiRequest<Framework[]>("/frameworks", { method: "POST", token: token!, body: framework })
        : apiRequest<Framework[]>(`/frameworks/${encodeURIComponent(framework.id)}`, {
            method: "PUT",
            token: token!,
            body: framework,
          }),
    onSuccess: (list, vars) => {
      if (Array.isArray(list)) qc.setQueryData(["frameworks"], list);
      else void qc.invalidateQueries({ queryKey: ["frameworks"] });
      setEditing(null);
      setFormError(null);
      toast.success(vars.isNew ? "Framework created" : "Framework updated", {
        description: "Publish on the Deploy tab to make it live.",
      });
    },
    onError: (err) => setFormError(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiRequest<Framework[]>(`/frameworks/${encodeURIComponent(id)}`, {
        method: "DELETE",
        token: token!,
      }),
    onSuccess: (list) => {
      if (Array.isArray(list)) qc.setQueryData(["frameworks"], list);
      else void qc.invalidateQueries({ queryKey: ["frameworks"] });
      toast.success("Framework deleted");
    },
    onError: (err) => toast.error("Could not delete framework", { description: errorMessage(err) }),
  });

  if (editing) {
    const { framework, isNew } = editing;
    return (
      <FrameworkForm
        framework={framework}
        isNew={isNew}
        error={formError}
        saving={save.isPending}
        onCancel={() => {
          setEditing(null);
          setFormError(null);
        }}
        onSubmit={(next) => save.mutate({ framework: next, isNew })}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Frameworks"
        description="The standards your products are grouped under, such as ISO 9001 or ISO 27001."
        actions={
          <Button
            onClick={() => {
              setEditing({ framework: { ...empty }, isNew: true });
              setFormError(null);
            }}
          >
            <Plus className="size-4" aria-hidden />
            New framework
          </Button>
        }
      />

      {frameworks.isLoading ? <Loading label="Loading frameworks…" /> : null}
      {frameworks.isError ? <InlineError message={errorMessage(frameworks.error)} /> : null}

      {frameworks.data && frameworks.data.length === 0 ? (
        <EmptyState title="No frameworks yet" hint="Add a framework before creating products." />
      ) : null}

      {frameworks.data && frameworks.data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {frameworks.data.map((framework) => (
            <Panel key={framework.id} className="flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="size-3 border border-border"
                    style={{ backgroundColor: framework.color ?? "#0D9488" }}
                  />
                  <h2 className="text-sm font-bold text-charcoal">{framework.name}</h2>
                </div>
                <p className="mt-1 text-xs text-slate">{framework.id}</p>
                <p className="mt-2 text-sm font-medium text-charcoal">{framework.full_name}</p>
                {framework.description ? (
                  <p className="mt-2 text-sm text-slate">{framework.description}</p>
                ) : null}
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing({ framework, isNew: false });
                    setFormError(null);
                  }}
                >
                  <Pencil className="size-3.5" aria-hidden />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-destructive/40 text-destructive hover:bg-destructive/5"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (window.confirm(`Delete framework "${framework.name}"?`)) {
                      remove.mutate(framework.id);
                    }
                  }}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  Delete
                </Button>
              </div>
            </Panel>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FrameworkForm({
  framework,
  isNew,
  error,
  saving,
  onCancel,
  onSubmit,
}: {
  framework: Framework;
  isNew: boolean;
  error: string | null;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (framework: Framework) => void;
}) {
  const [draft, setDraft] = useState<Framework>(framework);
  const [localError, setLocalError] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        title={isNew ? "New framework" : `Edit ${framework.name}`}
        description="The short id groups products; the full name appears on the storefront."
        actions={
          <Button variant="outline" onClick={onCancel}>
            <X className="size-4" aria-hidden />
            Cancel
          </Button>
        }
      />
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.id.trim() || !draft.name.trim()) {
            setLocalError("Both a short id and a name are required.");
            return;
          }
          setLocalError(null);
          onSubmit(draft);
        }}
      >
        <Panel className="grid gap-5 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="fw-name">Name</FieldLabel>
            <Input
              id="fw-name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="ISO 9001"
            />
          </div>
          <div>
            <FieldLabel htmlFor="fw-id">Short id</FieldLabel>
            <Input
              id="fw-id"
              value={draft.id}
              disabled={!isNew}
              onChange={(e) =>
                setDraft({ ...draft, id: e.target.value.toLowerCase().replace(/\s+/g, "-") })
              }
              placeholder="iso9001"
            />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="fw-full">Full name</FieldLabel>
            <Input
              id="fw-full"
              value={draft.full_name}
              onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
              placeholder="ISO 9001:2015 Quality Management Systems"
            />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="fw-desc">Description</FieldLabel>
            <Textarea
              id="fw-desc"
              rows={3}
              value={draft.description ?? ""}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>
          <div>
            <FieldLabel htmlFor="fw-color">Badge colour</FieldLabel>
            <div className="flex items-center gap-2">
              <input
                id="fw-color"
                type="color"
                value={draft.color ?? "#0D9488"}
                onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                className="h-9 w-14 border border-input bg-background p-1"
              />
              <Input
                aria-label="Badge colour hex"
                value={draft.color ?? ""}
                onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                placeholder="#0D9488"
              />
            </div>
          </div>
        </Panel>

        <InlineError message={localError ?? error} />

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : isNew ? "Create framework" : "Save changes"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
