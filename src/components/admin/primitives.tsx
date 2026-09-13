import { cn } from "@/lib/utils";
import { AlertTriangle, Loader2 } from "lucide-react";
import type { ReactNode, SelectHTMLAttributes } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-bold text-charcoal">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate">{description}</p>
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("panel p-5", className)}>{children}</section>;
}

export function InlineError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-10 text-sm text-slate">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="border border-dashed border-border bg-bg-alt px-6 py-10 text-center">
      <p className="text-sm font-semibold text-charcoal">{title}</p>
      <p className="mt-1 text-sm text-slate">{hint}</p>
    </div>
  );
}

export function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="label-caps mb-1.5 block">
      {children}
    </label>
  );
}

export function NativeSelect({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "h-9 w-full border border-input bg-background px-2 text-sm text-charcoal outline-none focus-visible:border-coral focus-visible:ring-2 focus-visible:ring-coral/30 disabled:opacity-60",
        className,
      )}
    />
  );
}

export function FrameworkBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center border border-coral-border bg-coral-pale px-2 py-0.5 text-xs font-semibold text-coral-dark">
      {label}
    </span>
  );
}

export function formatZar(value: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatBytes(bytes?: number | undefined): string {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
