import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Copy, Plus, RotateCcw, Save, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, errorMessage, SITE_BASE_URL } from "@/lib/api";
import { adminUpload } from "@/lib/admin.functions";
import { useAuth } from "@/lib/auth";
import {
  SECTION_LABELS,
  newId,
  type ContentRevision,
  type SiteContent,
  type SiteLink,
  type SitePage,
  type SiteSection,
} from "@/lib/site-content";
import { FieldLabel, InlineError, Loading, NativeSelect, PageHeader, Panel } from "../primitives";
import { cn } from "@/lib/utils";

type View = "pages" | "navigation" | "branding" | "text" | "editorial" | "history";
const VIEWS: { id: View; label: string }[] = [
  { id: "pages", label: "Pages" },
  { id: "navigation", label: "Navigation & footer" },
  { id: "branding", label: "Branding" },
  { id: "text", label: "Site-wide text" },
  { id: "editorial", label: "Guides & templates" },
  { id: "history", label: "History" },
];

function move<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      {children}
    </label>
  );
}

function Reorder({ onUp, onDown, onRemove }: { onUp: () => void; onDown: () => void; onRemove: () => void }) {
  return (
    <div className="flex shrink-0 gap-1">
      <Button size="icon" variant="ghost" aria-label="Move up" onClick={onUp}><ArrowUp className="size-4" /></Button>
      <Button size="icon" variant="ghost" aria-label="Move down" onClick={onDown}><ArrowDown className="size-4" /></Button>
      <Button size="icon" variant="ghost" aria-label="Remove" onClick={onRemove}><Trash2 className="size-4" /></Button>
    </div>
  );
}

export function SiteBuilderTab() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [view, setView] = useState<View>("pages");
  const [draft, setDraft] = useState<SiteContent | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const content = useQuery({
    queryKey: ["site-content"],
    queryFn: () => apiRequest<{ content: SiteContent; hasDraft: boolean; hasLive: boolean }>("/content", { token: token! }),
    enabled: Boolean(token),
  });

  useEffect(() => {
    if (content.data && !dirty) setDraft(structuredClone(content.data.content));
  }, [content.data, dirty]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = (fn: (c: SiteContent) => void) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
    setDirty(true);
  };

  const save = useMutation({
    mutationFn: (mode: "draft" | "publish") =>
      apiRequest<{ commit_url: string }>(mode === "draft" ? "/content/draft" : "/content/publish", {
        method: mode === "draft" ? "PUT" : "POST",
        token: token!,
        body: draft,
      }),
    onSuccess: (_r, mode) => {
      setDirty(false);
      setError(null);
      qc.invalidateQueries({ queryKey: ["site-content"] });
      qc.invalidateQueries({ queryKey: ["content-history"] });
      toast.success(mode === "draft" ? "Draft saved. The live site is unchanged." : "Published. The live site will update in a few minutes.");
    },
    onError: (e) => setError(errorMessage(e)),
  });

  if (content.isLoading || !draft) return content.error ? <InlineError message={errorMessage(content.error)} /> : <Loading />;

  return (
    <div>
      <PageHeader
        title="Site Builder"
        description="Edit pages, sections, navigation, branding and wording. Save a draft safely, then publish when ready."
        actions={
          <>
            <Button variant="outline" disabled={save.isPending} onClick={() => save.mutate("draft")}>
              <Save className="size-4" /> Save draft
            </Button>
            <Button
              disabled={save.isPending}
              onClick={() => {
                if (confirm("Publish these changes to the live website?")) save.mutate("publish");
              }}
            >
              <Upload className="size-4" /> Publish
            </Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-slate">
        {dirty ? <span className="bg-coral-pale px-2 py-1 font-semibold text-coral-dark">Unsaved changes</span> : null}
        {content.data?.hasDraft ? <span className="border border-border px-2 py-1">A saved draft exists</span> : null}
        {!content.data?.hasLive ? <span className="border border-border px-2 py-1">Not yet published — starting content shown</span> : null}
      </div>
      <InlineError message={error} />
      <div className="mb-5 mt-2 flex gap-1 overflow-x-auto border-b border-border">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            className={cn(
              "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
              view === v.id ? "border-coral text-charcoal" : "border-transparent text-slate hover:text-charcoal",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
      {view === "pages" ? <PagesView content={draft} update={update} /> : null}
      {view === "navigation" ? <NavigationView content={draft} update={update} /> : null}
      {view === "branding" ? <BrandingView content={draft} update={update} /> : null}
      {view === "text" ? <TextView content={draft} update={update} /> : null}
      {view === "editorial" ? <EditorialView content={draft} update={update} /> : null}
      {view === "history" ? (
        <HistoryView
          onRestored={() => {
            setDirty(false);
            qc.invalidateQueries({ queryKey: ["site-content"] });
          }}
        />
      ) : null}
    </div>
  );
}

type ViewProps = { content: SiteContent; update: (fn: (c: SiteContent) => void) => void };

function PagesView({ content, update }: ViewProps) {
  const [selected, setSelected] = useState(content.pages[0]?.id ?? "");
  const idx = content.pages.findIndex((p) => p.id === selected);
  const page = content.pages[idx];
  const setPage = (fn: (p: SitePage) => void) => update((c) => fn(c.pages[idx]!));

  return (
    <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
      <Panel className="p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="label-caps">Pages</p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const id = newId("page");
              update((c) => {
                c.pages.push({ id, name: "New page", slug: `/page-${c.pages.length + 1}`, published: false, seo: { title: "New page", description: "" }, sections: [] });
              });
              setSelected(id);
            }}
          >
            <Plus className="size-4" /> Add
          </Button>
        </div>
        <ul className="flex flex-col gap-0.5">
          {content.pages.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setSelected(p.id)}
                className={cn("w-full px-2 py-2 text-left text-sm", p.id === selected ? "bg-coral-pale font-semibold text-coral-dark" : "hover:bg-bg-alt")}
              >
                {p.name}
                <span className="block text-xs text-slate">{p.slug}{p.published ? "" : " · hidden"}</span>
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      {page ? (
        <div className="flex min-w-0 flex-col gap-5">
          <Panel>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-charcoal">Page details</h2>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => update((c) => { c.pages = move(c.pages, idx, -1); })}><ArrowUp className="size-4" /></Button>
                <Button size="sm" variant="outline" onClick={() => update((c) => { c.pages = move(c.pages, idx, 1); })}><ArrowDown className="size-4" /></Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const id = newId("page");
                    update((c) => { c.pages.splice(idx + 1, 0, { ...structuredClone(page), id, name: `${page.name} (copy)`, slug: `${page.slug === "/" ? "" : page.slug}-copy`, published: false }); });
                    setSelected(id);
                  }}
                >
                  <Copy className="size-4" /> Duplicate
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page.slug === "/"}
                  onClick={() => {
                    if (!confirm(`Remove the page "${page.name}"?`)) return;
                    update((c) => { c.pages.splice(idx, 1); });
                    setSelected(content.pages[0]?.id ?? "");
                  }}
                >
                  <Trash2 className="size-4" /> Remove
                </Button>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Page name"><Input value={page.name} onChange={(e) => setPage((p) => { p.name = e.target.value; })} /></Field>
              <Field label="Address"><Input value={page.slug} disabled={page.slug === "/" && idx === 0} onChange={(e) => setPage((p) => { p.slug = e.target.value; })} /></Field>
              <Field label="Browser title"><Input value={page.seo.title} onChange={(e) => setPage((p) => { p.seo.title = e.target.value; })} /></Field>
              <Field label="Canonical address (optional)"><Input value={page.seo.canonical ?? ""} onChange={(e) => setPage((p) => { p.seo.canonical = e.target.value || undefined; })} /></Field>
              <div className="sm:col-span-2">
                <Field label="Search description"><Textarea rows={2} value={page.seo.description} onChange={(e) => setPage((p) => { p.seo.description = e.target.value; })} /></Field>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={page.published} onChange={(e) => setPage((p) => { p.published = e.target.checked; })} /> Visible on the site
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={Boolean(page.seo.noindex)} onChange={(e) => setPage((p) => { p.seo.noindex = e.target.checked || undefined; })} /> Hide from search engines
              </label>
            </div>
          </Panel>

          <Panel>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold text-charcoal">Sections</h2>
              <NativeSelect
                className="w-auto"
                value=""
                onChange={(e) => {
                  const type = e.target.value as SiteSection["type"];
                  if (!type) return;
                  setPage((p) => { p.sections.push({ id: newId("sec"), type, heading: SECTION_LABELS[type] }); });
                }}
              >
                <option value="">+ Add section…</option>
                {Object.entries(SECTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </NativeSelect>
            </div>
            {page.sections.length === 0 ? <p className="text-sm text-slate">No sections yet.</p> : null}
            <div className="flex flex-col gap-3">
              {page.sections.map((s, si) => (
                <div key={s.id} className="border border-border p-3">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="label-caps">{SECTION_LABELS[s.type]}</span>
                    <Reorder
                      onUp={() => setPage((p) => { p.sections = move(p.sections, si, -1); })}
                      onDown={() => setPage((p) => { p.sections = move(p.sections, si, 1); })}
                      onRemove={() => { if (confirm("Remove this section?")) setPage((p) => { p.sections.splice(si, 1); }); }}
                    />
                  </div>
                  <SectionForm section={s} onChange={(fn) => setPage((p) => fn(p.sections[si]!))} />
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <h2 className="mb-3 font-semibold text-charcoal">Preview</h2>
            <PagePreview page={page} content={content} />
          </Panel>
        </div>
      ) : null}
    </div>
  );
}

function SectionForm({ section: s, onChange }: { section: SiteSection; onChange: (fn: (s: SiteSection) => void) => void }) {
  const hasButton = s.type === "hero" || s.type === "cta";
  const hasItems = s.type === "rich-text" || s.type === "cta";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Small label above heading"><Input value={s.eyebrow ?? ""} onChange={(e) => onChange((x) => { x.eyebrow = e.target.value || undefined; })} /></Field>
      <Field label="Heading"><Input value={s.heading} onChange={(e) => onChange((x) => { x.heading = e.target.value; })} /></Field>
      <div className="sm:col-span-2">
        <Field label="Text"><Textarea rows={3} value={s.body ?? ""} onChange={(e) => onChange((x) => { x.body = e.target.value || undefined; })} /></Field>
      </div>
      {hasButton ? (
        <>
          <Field label="Button text"><Input value={s.button_label ?? ""} onChange={(e) => onChange((x) => { x.button_label = e.target.value || undefined; })} /></Field>
          <Field label="Button link"><Input value={s.button_href ?? ""} onChange={(e) => onChange((x) => { x.button_href = e.target.value || undefined; })} /></Field>
        </>
      ) : null}
      {hasItems ? (
        <div className="sm:col-span-2">
          <Field label="Bullet points (one per line)">
            <Textarea rows={3} value={(s.items ?? []).join("\n")} onChange={(e) => onChange((x) => { x.items = e.target.value.split("\n"); })} />
          </Field>
        </div>
      ) : null}
      {s.type === "hero" || s.type === "cta" || s.type === "rich-text" ? (
        <div className="sm:col-span-2">
          <SectionImage section={s} onChange={onChange} />
        </div>
      ) : null}
    </div>
  );
}

function SectionImage({ section: s, onChange }: { section: SiteSection; onChange: (fn: (s: SiteSection) => void) => void }) {
  const { token } = useAuth();
  const [busy, setBusy] = useState(false);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return toast.error("Only PNG, JPG and WebP images can be used.");
    if (file.size > 5 * 1024 * 1024) return toast.error("That image is larger than 5 MB.");
    setBusy(true);
    try {
      const form = new FormData();
      form.set("token", token ?? "");
      form.set("kind", "site-image");
      form.set("file", file, file.name);
      const res = (await adminUpload({ data: form })) as { name: string };
      onChange((x) => { x.image = res.name; });
      toast.success("Image uploaded", { description: "Save draft or publish to use it on the page." });
    } catch (err) {
      toast.error("Upload failed", { description: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid gap-3 border border-border bg-bg-alt p-3 sm:grid-cols-[160px_1fr]">
      <div className="flex aspect-video items-center justify-center border border-border bg-background text-xs text-slate">
        {s.image ? <img src={`${SITE_BASE_URL}/site-images/${s.image}`} alt={s.image_alt ?? ""} className="size-full object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} /> : "No image"}
      </div>
      <div className="space-y-2">
        <Field label="Section image (PNG, JPG or WebP, up to 5 MB)">
          <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(e) => void pick(e.target.files?.[0])} className="w-full text-sm" />
        </Field>
        {busy ? <p className="text-xs text-slate">Uploading…</p> : null}
        {s.image ? (
          <>
            <p className="text-xs text-slate">{s.image} · preview appears after the next publish.</p>
            <Field label="Image description (for screen readers and search)"><Input value={s.image_alt ?? ""} onChange={(e) => onChange((x) => { x.image_alt = e.target.value || undefined; })} /></Field>
            <Button variant="outline" size="sm" onClick={() => onChange((x) => { x.image = undefined; x.image_alt = undefined; })}>Remove image</Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function PagePreview({ page, content }: { page: SitePage; content: SiteContent }) {
  const [mobile, setMobile] = useState(false);
  return (
    <div>
      <div className="mb-3 flex gap-2">
        <Button size="sm" variant={mobile ? "outline" : "default"} onClick={() => setMobile(false)}>Desktop</Button>
        <Button size="sm" variant={mobile ? "default" : "outline"} onClick={() => setMobile(true)}>Mobile</Button>
      </div>
      <div className={cn("mx-auto overflow-hidden border border-border bg-background", mobile ? "max-w-[375px]" : "w-full")}>
        <div className="flex flex-wrap items-center justify-between gap-2 bg-charcoal px-4 py-3 text-sidebar-foreground">
          <span className="font-bold">{content.theme.logo_text}</span>
          <span className="flex flex-wrap gap-3 text-xs">{content.navigation.map((n) => <span key={n.id}>{n.label}</span>)}</span>
        </div>
        {page.sections.map((s) => (
          <div key={s.id} className={cn("border-b border-border px-5 py-6", s.type === "hero" && "bg-coral-pale")}>
            {s.eyebrow ? <p className="label-caps mb-1">{s.eyebrow}</p> : null}
            <p className={cn("font-bold text-charcoal", s.type === "hero" ? "text-2xl" : "text-lg")}>{s.heading}</p>
            {s.body ? <p className="mt-2 text-sm text-slate">{s.body}</p> : null}
            {s.items?.filter(Boolean).length ? <ul className="mt-2 list-disc pl-5 text-sm text-slate">{s.items.filter(Boolean).map((i) => <li key={i}>{i}</li>)}</ul> : null}
            {s.type === "product-grid" || s.type === "framework-grid" ? <p className="mt-2 text-xs italic text-slate">Shows your {s.type === "product-grid" ? "products" : "frameworks"} automatically.</p> : null}
            {s.button_label ? <span className="mt-3 inline-block bg-coral px-3 py-1.5 text-xs font-semibold text-primary-foreground">{s.button_label}</span> : null}
          </div>
        ))}
        <div className="bg-bg-alt px-5 py-4 text-xs text-slate">{content.footer.tagline}<br />{content.footer.legal}</div>
      </div>
    </div>
  );
}

function LinksEditor({ links, onChange }: { links: SiteLink[]; onChange: (links: SiteLink[]) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {links.map((l, i) => (
        <div key={l.id} className="flex flex-col gap-2 border border-border p-2 sm:flex-row sm:items-center">
          <Input aria-label="Label" placeholder="Label" value={l.label} onChange={(e) => onChange(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          <Input aria-label="Link" placeholder="/page or https://…" value={l.href} onChange={(e) => onChange(links.map((x, j) => (j === i ? { ...x, href: e.target.value, external: /^https?:/.test(e.target.value) } : x)))} />
          <Reorder onUp={() => onChange(move(links, i, -1))} onDown={() => onChange(move(links, i, 1))} onRemove={() => onChange(links.filter((_, j) => j !== i))} />
        </div>
      ))}
      <Button variant="outline" size="sm" className="self-start" onClick={() => onChange([...links, { id: newId("link"), label: "New link", href: "/" }])}>
        <Plus className="size-4" /> Add link
      </Button>
    </div>
  );
}

function NavigationView({ content, update }: ViewProps) {
  return (
    <div className="flex flex-col gap-5">
      <Panel>
        <h2 className="mb-3 font-semibold text-charcoal">Header menu</h2>
        <LinksEditor links={content.navigation} onChange={(l) => update((c) => { c.navigation = l; })} />
      </Panel>
      <Panel>
        <h2 className="mb-3 font-semibold text-charcoal">Footer</h2>
        <div className="mb-4 grid gap-3">
          <Field label="Tagline"><Input value={content.footer.tagline} onChange={(e) => update((c) => { c.footer.tagline = e.target.value; })} /></Field>
          <Field label="Legal line"><Input value={content.footer.legal} onChange={(e) => update((c) => { c.footer.legal = e.target.value; })} /></Field>
          <Field label="Payment note"><Input value={content.footer.payment_note} onChange={(e) => update((c) => { c.footer.payment_note = e.target.value; })} /></Field>
        </div>
        <LinksEditor links={content.footer.links} onChange={(l) => update((c) => { c.footer.links = l; })} />
      </Panel>
    </div>
  );
}

function BrandingView({ content, update }: ViewProps) {
  const t = content.theme;
  const color = (key: "primary" | "accent" | "background" | "text", label: string) => (
    <Field label={label}>
      <div className="flex gap-2">
        <input type="color" aria-label={label} value={t[key]} onChange={(e) => update((c) => { c.theme[key] = e.target.value; })} className="h-9 w-12 border border-input" />
        <Input value={t[key]} onChange={(e) => update((c) => { c.theme[key] = e.target.value; })} />
      </div>
    </Field>
  );
  return (
    <Panel>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Logo text"><Input value={t.logo_text} onChange={(e) => update((c) => { c.theme.logo_text = e.target.value; })} /></Field>
        <Field label="Font"><Input value={t.font_family} onChange={(e) => update((c) => { c.theme.font_family = e.target.value; })} /></Field>
        {color("primary", "Main colour")}
        {color("accent", "Accent colour")}
        {color("background", "Background")}
        {color("text", "Text colour")}
        <Field label="Spacing">
          <NativeSelect value={t.density} onChange={(e) => update((c) => { c.theme.density = e.target.value as typeof t.density; })}>
            <option value="compact">Compact</option><option value="comfortable">Comfortable</option><option value="spacious">Spacious</option>
          </NativeSelect>
        </Field>
        <Field label="Corners">
          <NativeSelect value={t.corner_style} onChange={(e) => update((c) => { c.theme.corner_style = e.target.value as typeof t.corner_style; })}>
            <option value="sharp">Sharp</option><option value="soft">Soft</option><option value="rounded">Rounded</option>
          </NativeSelect>
        </Field>
      </div>
    </Panel>
  );
}

const TEXT_FIELDS: { key: keyof Omit<SiteContent["globals"], "home_faqs">; label: string; long?: boolean }[] = [
  { key: "buy_label", label: "Buy button" },
  { key: "product_includes_label", label: "Product 'includes' heading" },
  { key: "delivery_email_label", label: "Delivery email label" },
  { key: "vat_note", label: "Price note" },
  { key: "contact_heading", label: "Contact heading" },
  { key: "contact_body", label: "Contact text", long: true },
  { key: "not_found_heading", label: "Missing page heading" },
  { key: "not_found_body", label: "Missing page text", long: true },
  { key: "not_found_button", label: "Missing page button" },
];

function TextView({ content, update }: ViewProps) {
  const g = content.globals;
  return (
    <div className="flex flex-col gap-5">
      <Panel>
        <div className="grid gap-4 sm:grid-cols-2">
          {TEXT_FIELDS.map((f) => (
            <div key={f.key} className={f.long ? "sm:col-span-2" : ""}>
              <Field label={f.label}>
                {f.long ? (
                  <Textarea rows={2} value={g[f.key]} onChange={(e) => update((c) => { c.globals[f.key] = e.target.value; })} />
                ) : (
                  <Input value={g[f.key]} onChange={(e) => update((c) => { c.globals[f.key] = e.target.value; })} />
                )}
              </Field>
            </div>
          ))}
        </div>
      </Panel>
      <Panel>
        <h2 className="mb-3 font-semibold text-charcoal">Frequently asked questions</h2>
        <div className="flex flex-col gap-3">
          {g.home_faqs.map((f, i) => (
            <div key={f.id} className="border border-border p-3">
              <div className="mb-2 flex justify-end">
                <Reorder
                  onUp={() => update((c) => { c.globals.home_faqs = move(c.globals.home_faqs, i, -1); })}
                  onDown={() => update((c) => { c.globals.home_faqs = move(c.globals.home_faqs, i, 1); })}
                  onRemove={() => update((c) => { c.globals.home_faqs.splice(i, 1); })}
                />
              </div>
              <Input placeholder="Question" value={f.question} onChange={(e) => update((c) => { c.globals.home_faqs[i]!.question = e.target.value; })} />
              <Textarea className="mt-2" rows={2} placeholder="Answer" value={f.answer} onChange={(e) => update((c) => { c.globals.home_faqs[i]!.answer = e.target.value; })} />
            </div>
          ))}
          <Button variant="outline" size="sm" className="self-start" onClick={() => update((c) => { c.globals.home_faqs.push({ id: newId("faq"), question: "", answer: "" }); })}>
            <Plus className="size-4" /> Add question
          </Button>
        </div>
      </Panel>
    </div>
  );
}

function EditorialView({ content, update }: ViewProps) {
  const [kind, setKind] = useState<"guides" | "templates">("guides");
  const [sel, setSel] = useState(0);
  const list = content[kind];
  const p = list[sel];
  const edit = (fn: (x: (typeof list)[number]) => void) => update((c) => { const x = c[kind][sel]; if (x) fn(x); });
  const base = kind === "guides" ? "/guides/" : "/templates/";
  return (
    <div className="flex flex-col gap-5">
      <Panel>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type">
            <NativeSelect value={kind} onChange={(e) => { setKind(e.target.value as "guides" | "templates"); setSel(0); }}>
              <option value="guides">Guide pages</option>
              <option value="templates">Template pages</option>
            </NativeSelect>
          </Field>
          <Field label="Page">
            <NativeSelect value={String(sel)} onChange={(e) => setSel(Number(e.target.value))}>
              {list.map((x, i) => <option key={x.id} value={i}>{x.h1 || x.id}</option>)}
            </NativeSelect>
          </Field>
        </div>
      </Panel>
      {p ? (
        <>
          <Panel>
            <p className="mb-3 text-sm text-slate">Address: {base}{p.id}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Badge"><Input value={p.badge} onChange={(e) => edit((x) => { x.badge = e.target.value; })} /></Field>
              <Field label="Main heading"><Input value={p.h1} onChange={(e) => edit((x) => { x.h1 = e.target.value; })} /></Field>
              <Field label="Browser title"><Input value={p.metaTitle} onChange={(e) => edit((x) => { x.metaTitle = e.target.value; })} /></Field>
              <Field label="Search description"><Input value={p.metaDescription} onChange={(e) => edit((x) => { x.metaDescription = e.target.value; })} /></Field>
              <div className="sm:col-span-2">
                <Field label="Introduction (blank line between paragraphs)">
                  <Textarea rows={5} value={p.intro.join("\n\n")} onChange={(e) => edit((x) => { x.intro = e.target.value.split(/\n{2,}/); })} />
                </Field>
              </div>
            </div>
          </Panel>
          <Panel>
            <h2 className="mb-3 font-semibold text-charcoal">Sections</h2>
            <div className="flex flex-col gap-3">
              {p.sections.map((s, i) => (
                <div key={s.id} className="border border-border p-3">
                  <div className="mb-2 flex justify-end">
                    <Reorder
                      onUp={() => edit((x) => { x.sections = move(x.sections, i, -1); })}
                      onDown={() => edit((x) => { x.sections = move(x.sections, i, 1); })}
                      onRemove={() => edit((x) => { x.sections.splice(i, 1); })}
                    />
                  </div>
                  <Input placeholder="Heading" value={s.heading} onChange={(e) => edit((x) => { x.sections[i]!.heading = e.target.value; })} />
                  <Textarea className="mt-2" rows={5} placeholder="Paragraphs (blank line between)" value={s.paragraphs.join("\n\n")} onChange={(e) => edit((x) => { x.sections[i]!.paragraphs = e.target.value.split(/\n{2,}/); })} />
                </div>
              ))}
              <Button variant="outline" size="sm" className="self-start" onClick={() => edit((x) => { x.sections.push({ id: newId("sec"), heading: "", paragraphs: [] }); })}>
                <Plus className="size-4" /> Add section
              </Button>
            </div>
          </Panel>
          <Panel>
            <h2 className="mb-3 font-semibold text-charcoal">Questions and answers</h2>
            <div className="flex flex-col gap-3">
              {p.faqs.map((f, i) => (
                <div key={f.id} className="border border-border p-3">
                  <div className="mb-2 flex justify-end">
                    <Reorder
                      onUp={() => edit((x) => { x.faqs = move(x.faqs, i, -1); })}
                      onDown={() => edit((x) => { x.faqs = move(x.faqs, i, 1); })}
                      onRemove={() => edit((x) => { x.faqs.splice(i, 1); })}
                    />
                  </div>
                  <Input placeholder="Question" value={f.question} onChange={(e) => edit((x) => { x.faqs[i]!.question = e.target.value; })} />
                  <Textarea className="mt-2" rows={2} placeholder="Answer" value={f.answer} onChange={(e) => edit((x) => { x.faqs[i]!.answer = e.target.value; })} />
                </div>
              ))}
              <Button variant="outline" size="sm" className="self-start" onClick={() => edit((x) => { x.faqs.push({ id: newId("faq"), question: "", answer: "" }); })}>
                <Plus className="size-4" /> Add question
              </Button>
            </div>
          </Panel>
        </>
      ) : null}
    </div>
  );
}


function HistoryView({ onRestored }: { onRestored: () => void }) {
  const { token } = useAuth();
  const history = useQuery({
    queryKey: ["content-history"],
    queryFn: () => apiRequest<ContentRevision[]>("/content/history", { token: token! }),
    enabled: Boolean(token),
  });
  const restore = useMutation({
    mutationFn: (sha: string) => apiRequest("/content/restore", { method: "POST", token: token!, body: { sha } }),
    onSuccess: () => {
      toast.success("Restored into your draft. Review it, then publish.");
      onRestored();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  if (history.isLoading) return <Loading />;
  if (history.error) return <InlineError message={errorMessage(history.error)} />;
  if (!history.data?.length) return <p className="text-sm text-slate">Nothing published yet.</p>;
  return (
    <Panel className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <tbody>
          {history.data.map((r) => (
            <tr key={r.sha} className="border-b border-border">
              <td className="px-4 py-3">{new Date(r.date).toLocaleString()}</td>
              <td className="px-4 py-3"><a className="text-blue underline" href={r.url} target="_blank" rel="noreferrer">{r.message}</a></td>
              <td className="px-4 py-3 text-right">
                <Button size="sm" variant="outline" disabled={restore.isPending} onClick={() => { if (confirm("Load this version into your draft?")) restore.mutate(r.sha); }}>
                  <RotateCcw className="size-4" /> Restore
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
