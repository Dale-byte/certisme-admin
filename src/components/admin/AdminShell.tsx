import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import {
  Boxes,
  FileText,
  History,
  Image as ImageIcon,
  LayoutGrid,
  LogOut,
  Menu,
  Rocket,
  Settings,
  X,
} from "lucide-react";

export const TABS = [
  { id: "products", label: "Products", icon: Boxes },
  { id: "frameworks", label: "Frameworks", icon: LayoutGrid },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "images", label: "Images", icon: ImageIcon },
  { id: "settings", label: "Site Settings", icon: Settings },
  { id: "deploy", label: "Deploy", icon: Rocket },
  { id: "audit", label: "Audit Log", icon: History },
] as const;

export type TabId = (typeof TABS)[number]["id"];

export function AdminShell({
  active,
  onChange,
  children,
}: {
  active: TabId;
  onChange: (tab: TabId) => void;
  children: ReactNode;
}) {
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-0.5" aria-label="Admin sections">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            aria-current={isActive ? "page" : undefined}
            onClick={() => {
              onChange(tab.id);
              setMobileOpen(false);
            }}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2.5 text-left text-sm font-medium transition-colors",
              isActive
                ? "bg-coral text-primary-foreground"
                : "text-sidebar-foreground/75 hover:bg-charcoal-mid hover:text-sidebar-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {tab.label}
          </button>
        );
      })}
    </nav>
  );

  const identity = (
    <div className="border-t border-slate/60 px-3 py-4">
      <p className="truncate text-xs font-semibold text-sidebar-foreground">
        {user?.name ?? "Administrator"}
      </p>
      <p className="truncate text-xs text-sidebar-foreground/60">{user?.email}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => signOut()}
        className="mt-3 w-full border-slate bg-transparent text-sidebar-foreground hover:bg-charcoal-mid hover:text-sidebar-foreground"
      >
        <LogOut className="size-4" aria-hidden />
        Sign out
      </Button>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-bg-alt">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between bg-charcoal lg:flex">
        <div>
          <div className="border-b border-slate/60 px-4 py-5">
            <p className="text-sm font-bold tracking-tight text-sidebar-foreground">
              CertiSME <span className="text-coral-border">Admin</span>
            </p>
            <p className="mt-1 text-xs text-sidebar-foreground/60">Storefront content control</p>
          </div>
          <div className="p-2">{nav}</div>
        </div>
        {identity}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between bg-charcoal px-4 py-3 lg:hidden">
          <p className="text-sm font-bold text-sidebar-foreground">
            CertiSME <span className="text-coral-border">Admin</span>
          </p>
          <Button
            variant="ghost"
            size="icon"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="text-sidebar-foreground hover:bg-charcoal-mid hover:text-sidebar-foreground"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </header>
        {mobileOpen ? (
          <div className="sticky top-[52px] z-20 bg-charcoal pb-2 lg:hidden">
            <div className="p-2">{nav}</div>
            {identity}
          </div>
        ) : null}

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
