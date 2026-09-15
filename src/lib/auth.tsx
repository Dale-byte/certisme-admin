import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest, errorMessage } from "./api";

const STORAGE_KEY = "certisme-admin-session";
const MAX_SESSION_MS = 24 * 60 * 60 * 1000;

export type AdminUser = { email: string; name?: string | undefined; picture?: string | undefined };

type Session = { token: string; issuedAt: number; user: AdminUser };

type AuthState = {
  status: "loading" | "signed-out" | "signed-in" | "unauthorized";
  user: AdminUser | null;
  token: string | null;
  error: string | null;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: (reason?: string) => void;
};

const AuthContext = createContext<AuthState | null>(null);

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed?.token || !parsed?.issuedAt) return null;
    if (Date.now() - parsed.issuedAt > MAX_SESSION_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthState["status"]>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signOut = useCallback((reason?: string) => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
    setSession(null);
    setStatus("signed-out");
    setError(reason ?? null);
  }, []);

  /** Confirms a stored token is still valid via GET /auth/me. */
  const verify = useCallback(async (token: string, user: AdminUser, issuedAt: number) => {
    try {
      const me = await apiRequest<{ email?: string; name?: string; picture?: string }>("/auth/me", {
        token,
      });
      const confirmed: AdminUser = {
        email: me?.email ?? user.email,
        name: me?.name ?? user.name,
        picture: me?.picture ?? user.picture,
      };
      const next: Session = { token, issuedAt, user: confirmed };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSession(next);
      setStatus("signed-in");
      setError(null);
    } catch (err) {
      localStorage.removeItem(STORAGE_KEY);
      setSession(null);
      setStatus("signed-out");
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    const existing = loadSession();
    if (!existing) {
      setStatus("signed-out");
      return;
    }
    void verify(existing.token, existing.user, existing.issuedAt);
  }, [verify]);

  // Auto-logout when the 24 hour window closes while the tab is open.
  useEffect(() => {
    if (!session) return;
    const remaining = session.issuedAt + MAX_SESSION_MS - Date.now();
    const timer = window.setTimeout(
      () => signOut("Your 24 hour session ended. Please sign in again."),
      Math.max(remaining, 0),
    );
    return () => window.clearTimeout(timer);
  }, [session, signOut]);

  const signIn = useCallback(async (username: string, password: string) => {
    setStatus("loading");
    setError(null);
    try {
      const res = await apiRequest<{
        token?: string;
        access_token?: string;
        user?: { email?: string; name?: string };
      }>("/auth/login", {
        method: "POST",
        token: "",
        body: { username, email: username, password },
      });
      const token = res?.token ?? res?.access_token ?? "";
      if (!token) {
        setStatus("signed-out");
        setError("Sign-in did not return a session. Please try again.");
        return;
      }
      const issuedAt = Date.now();
      const user: AdminUser = {
        email: res.user?.email ?? username,
        name: res.user?.name,
      };
      const next: Session = { token, issuedAt, user };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSession(next);
      setStatus("signed-in");
    } catch (err) {
      setSession(null);
      setStatus("signed-out");
      setError(errorMessage(err));
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      status,
      user: session?.user ?? null,
      token: session?.token ?? null,
      error,
      signIn,
      signOut,
    }),
    [status, session, error, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** Token guaranteed non-null inside the signed-in dashboard. */
export function useToken(): string {
  const { token } = useAuth();
  return token ?? "";
}
