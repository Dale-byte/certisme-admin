import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { AuthProvider, useAuth } from "@/lib/auth";
import { LoginScreen } from "@/components/admin/LoginScreen";
import { Dashboard } from "@/components/admin/Dashboard";

const title = "CertiSME Admin — Storefront content control";
const description =
  "Private admin dashboard for managing CertiSME storefront products, frameworks, documents, images and publishing.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}

function Gate() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-charcoal">
        <p className="flex items-center gap-2 text-sm text-white/70">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Checking your access…
        </p>
      </div>
    );
  }

  if (status === "signed-in") return <Dashboard />;
  return <LoginScreen />;
}
