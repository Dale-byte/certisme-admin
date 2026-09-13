import { useEffect, useRef } from "react";
import { API_BASE_URL, GOOGLE_CLIENT_ID } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { InlineError, Panel } from "./primitives";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

export function LoginScreen() {
  const { signInWithCredential, error, status, signOut } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;

    const render = () => {
      const id = window.google?.accounts?.id;
      if (!id || !buttonRef.current || cancelled) return false;
      id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (res) => {
          if (res.credential) void signInWithCredential(res.credential);
        },
        auto_select: false,
      });
      id.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
        text: "signin_with",
        width: 280,
        shape: "rectangular",
      });
      return true;
    };

    if (render()) return;
    const interval = window.setInterval(() => {
      if (render()) window.clearInterval(interval);
    }, 300);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [signInWithCredential]);

  const unauthorized = status === "unauthorized";

  return (
    <div className="flex min-h-screen items-center justify-center bg-charcoal px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-lg font-bold text-white">
            CertiSME <span className="text-coral-border">Admin</span>
          </p>
          <p className="mt-1 text-sm text-white/60">Storefront content control</p>
        </div>

        <Panel className="bg-background">
          {unauthorized ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-charcoal">
                <ShieldCheck className="size-5 text-destructive" aria-hidden />
                <h2 className="text-base font-bold">You are not authorized</h2>
              </div>
              <p className="text-sm text-slate">
                This account cannot manage the CertiSME storefront. Sign in with the approved
                administrator account, or ask for access to be granted on the API.
              </p>
              <InlineError message={error} />
              <Button onClick={() => signOut()} className="w-full">
                Try a different account
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-charcoal">Sign in to continue</h2>
                <p className="mt-1 text-sm text-slate">
                  Access is limited to the single approved administrator account. Every change you
                  make is recorded as a commit.
                </p>
              </div>

              <InlineError message={error} />

              {GOOGLE_CLIENT_ID ? (
                <div className="flex justify-center pt-1">
                  <div ref={buttonRef} />
                </div>
              ) : (
                <div className="border border-dashed border-border bg-bg-alt p-4 text-sm text-slate">
                  Google sign-in is not configured yet. Add your Google client ID as
                  <code className="mx-1 bg-background px-1 py-0.5 text-xs">VITE_GOOGLE_CLIENT_ID</code>
                  and reload.
                </div>
              )}

              {!API_BASE_URL ? (
                <p className="text-xs text-destructive">
                  The API address is missing. Set VITE_API_BASE_URL before signing in.
                </p>
              ) : null}
            </div>
          )}
        </Panel>

        <p className="mt-4 text-center text-xs text-white/45">
          Sessions end automatically after 24 hours.
        </p>
      </div>
    </div>
  );
}
