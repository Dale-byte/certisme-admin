import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ADMIN_EMAIL, GOOGLE_CLIENT_ID, apiRequest, errorMessage } from "./api";

const STORAGE_KEY = "certisme-admin-session";
const MAX_SESSION_MS = 24 * 60 * 60 * 1000;

export type AdminUser = { email: string; name?: string | undefined; picture?: string | undefined };

type Session = { token: string; issuedAt: number; user: AdminUser };

type AuthState = {
  status: "loading" | "signed-out" | "signed-in" | "unauthorized";
  user: AdminUser | null;
  token: string | null;
  error: string | null;
  signInWithCredential: (idToken: string) => Promise<void>;
  signOut: (reason?: string) => void;
};

const AuthContext = createContext<AuthState | null>(null);

function decodeEmail(idToken: string): AdminUser | null {
  try {
    const payload = idToken.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(
      decodeURIComponent(
        atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
          .split("")
          .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
          .join(""),
      ),
    ) as { email?: string; name?: string; picture?: string };
    if (!json.email) return null;
    return { email: json.email, name: json.name, picture: json.picture };
  } catch {
    return null;
  }
}

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
      window.google?.accounts?.id?.disableAutoSelect?.();
    } catch {
      /* storage unavailable */
    }
    setSession(null);
    setStatus("signed-out");
    setError(reason ?? null);
  }, []);

  const verify = useCallback(
    async (token: string, user: AdminUser, issuedAt: number) => {
      if (ADMIN_EMAIL && user.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
        setSession(null);
        setStatus("unauthorized");
        setError("This Google account is not the configured administrator account.");
        return;
      }
      try {
        const me = await apiRequest<{ email?: string; name?: string; picture?: string }>(
          "/auth/me",
          { token },
        );
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
        setStatus("unauthorized");
        setError(errorMessage(err));
      }
    },
    [],
  );

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

  const signInWithCredential = useCallback(
    async (idToken: string) => {
      const user = decodeEmail(idToken);
      if (!user) {
        setStatus("signed-out");
        setError("Google sign-in did not return a usable account.");
        return;
      }
      setStatus("loading");
      await verify(idToken, user, Date.now());
    },
    [verify],
  );

  const value = useMemo<AuthState>(
    () => ({
      status,
      user: session?.user ?? null,
      token: session?.token ?? null,
      error,
      signInWithCredential,
      signOut,
    }),
    [status, session, error, signInWithCredential, signOut],
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

export { GOOGLE_CLIENT_ID };

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (res: { credential?: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
          disableAutoSelect?: () => void;
        };
      };
    };
  }
}
