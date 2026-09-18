import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { FieldLabel, InlineError, Panel } from "./primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

export function LoginScreen() {
  const { signIn, error, status } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const busy = status === "loading";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    await signIn(username.trim(), password);
    setPassword("");
  }

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
          <form className="space-y-4" onSubmit={onSubmit}>
            <div>
              <h1 className="text-base font-bold text-charcoal">Sign in to continue</h1>
              <p className="mt-1 text-sm text-slate">
                Use your administrator username and password. Every change you make is recorded as a
                commit.
              </p>
            </div>

            <InlineError message={error} />

            <div className="space-y-1.5">
              <FieldLabel htmlFor="username">Username or email</FieldLabel>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={busy}
              />
            </div>

            <div className="space-y-1.5">
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={busy}
              />
            </div>

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {busy ? "Signing in…" : "Sign in"}
            </Button>

          </form>
        </Panel>

        <p className="mt-4 text-center text-xs text-white/45">
          Sessions end automatically after 24 hours.
        </p>
      </div>
    </div>
  );
}
