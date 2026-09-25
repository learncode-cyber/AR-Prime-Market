import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  adminChecked: boolean;
  /**
   * Module 3 (Global Auth RBAC): all roles held by the current user
   * (e.g. `["admin"]`, `["moderator"]`, `[]` for a plain customer).
   * `isAdmin` is now derived from this array (`roles.includes("admin")`)
   * and kept for backward compatibility with existing call sites — no
   * consumer of `isAdmin` needs to change.
   */
  roles: string[];
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Canonical owner/admin account, permanently seeded with the admin role in
// migration 20260519040605_ee56cd01-f82f-4296-a457-2ae38c87b394.sql. This is
// a client-side UX/reliability fast path only (skips a redundant RPC round
// trip for admin-panel routing) — it is NOT a new trust boundary. Every
// actual data access is still independently enforced server-side via the
// has_role() RPC and RLS policies regardless of this shortcut.
const OWNER_ADMIN_EMAIL = "biz.arprimemarket@gmail.com";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [adminChecked, setAdminChecked] = useState(false);

  const checkAdmin = async (u: User): Promise<boolean> => {
    if (u.email?.toLowerCase() === OWNER_ADMIN_EMAIL) {
      setRoles(["admin"]);
      setIsAdmin(true);
      setAdminChecked(true);
      return true;
    }
    // Security-definer RPC (bypasses any RLS issues on user_roles).
    // Fetches ALL roles in one call (Module 3 RBAC), not just admin —
    // isAdmin is derived from the result, so this is still exactly one
    // RPC round trip per identity change, same as the previous admin-only
    // has_role() check.
    try {
      const { data, error } = await supabase.rpc("get_user_roles", { p_user: u.id });
      if (!error && Array.isArray(data)) {
        const userRoles = data as string[];
        setRoles(userRoles);
        const admin = userRoles.includes("admin");
        setIsAdmin(admin);
        setAdminChecked(true);
        return admin;
      }
    } catch {
      // fall through to direct table read
    }
    // Direct user_roles read fallback.
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.id);
    const userRoles = (data ?? []).map((r) => r.role as string);
    setRoles(userRoles);
    const result = userRoles.includes("admin");
    setIsAdmin(result);
    setAdminChecked(true);
    return result;
  };

  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const handleSession = async (s: Session | null) => {
      if (cancelled) return;
      const newUserId = s?.user?.id ?? null;
      const userChanged = newUserId !== lastUserIdRef.current;

      setSession(s);
      setUser(s?.user ?? null);

      if (s?.user) {
        // Only re-check admin when the actual user identity changes.
        // Token refreshes / USER_UPDATED events keep the existing admin state,
        // so the layout doesn't flip back to its loading spinner.
        if (userChanged) {
          lastUserIdRef.current = newUserId;
          setAdminChecked(false);
          await checkAdmin(s.user);
        }
      } else {
        lastUserIdRef.current = null;
        setIsAdmin(false);
        setRoles([]);
        setAdminChecked(true);
      }
      setLoading(false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      // Defer to avoid running Supabase calls inside the auth callback.
      setTimeout(() => {
        void handleSession(s);
      }, 0);
    });

    // onAuthStateChange already fires an INITIAL_SESSION event on subscribe,
    // so we don't also call getSession() — that was causing a double load.

    const refreshInterval = setInterval(
      async () => {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();
        if (currentSession) {
          await supabase.auth.refreshSession();
        }
      },
      10 * 60 * 1000,
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      clearInterval(refreshInterval);
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectTo = typeof window !== "undefined" ? window.location.origin : undefined;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: redirectTo,
      },
    });
    return { error: error?.message ?? null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{ user, session, loading, isAdmin, roles, adminChecked, signUp, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
};

const defaultAuth: AuthContextType = {
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  roles: [],
  adminChecked: false,
  signUp: async () => ({ error: "Not initialized" }),
  signIn: async () => ({ error: "Not initialized" }),
  signOut: async () => {},
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  return ctx ?? defaultAuth;
};
