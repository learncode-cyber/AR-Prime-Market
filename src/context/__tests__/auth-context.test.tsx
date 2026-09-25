import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import type { Session, User } from "@supabase/supabase-js";

// --- Mock supabase client BEFORE importing AuthProvider ---
type AuthCb = (event: string, session: Session | null) => void;
const listeners: AuthCb[] = [];
const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: AuthCb) => {
        listeners.push(cb);
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      getSession: vi.fn(async () => ({ data: { session: null } })),
      refreshSession: vi.fn(async () => ({ data: { session: null } })),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import { AuthProvider, useAuth } from "@/context/AuthContext";

function Probe() {
  const { user, isAdmin, roles, adminChecked, loading } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="adminChecked">{String(adminChecked)}</span>
      <span data-testid="isAdmin">{String(isAdmin)}</span>
      <span data-testid="roles">{roles.join(",")}</span>
      <span data-testid="userId">{user?.id ?? "none"}</span>
    </div>
  );
}

const emitAuth = (event: string, session: Session | null) => {
  listeners.forEach((cb) => cb(event, session));
};

const mkSession = (id: string, email: string): Session =>
  ({
    access_token: "tok-" + id,
    refresh_token: "r",
    expires_in: 3600,
    token_type: "bearer",
    user: { id, email } as User,
  }) as Session;

beforeEach(() => {
  listeners.length = 0;
  rpcMock.mockReset();
  fromMock.mockReset();
  rpcMock.mockResolvedValue({ data: ["admin"], error: null });
  cleanup();
});

describe("AuthContext single-load behavior", () => {
  it("checks admin only ONCE on initial sign-in (no double-load)", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    emitAuth("SIGNED_IN", mkSession("u1", "biz.arprimemarket@gmail.com"));

    await waitFor(() => {
      expect(screen.getByTestId("adminChecked").textContent).toBe("true");
    });
    expect(screen.getByTestId("isAdmin").textContent).toBe("true");
    // Allowlisted email short-circuits — RPC must not be called at all.
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("does NOT re-run admin check on TOKEN_REFRESHED / USER_UPDATED for same user", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    const session = mkSession("u2", "shopper@example.com");
    emitAuth("SIGNED_IN", session);
    await waitFor(() => expect(screen.getByTestId("userId").textContent).toBe("u2"));
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1));

    // Simulate token refresh + user_updated (same user id) — must NOT re-check.
    emitAuth("TOKEN_REFRESHED", { ...session, access_token: "tok-new" });
    emitAuth("USER_UPDATED", session);

    // Give any stray deferred work a chance to run.
    await new Promise((r) => setTimeout(r, 20));

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("adminChecked").textContent).toBe("true");
  });

  it("re-runs admin check when the user identity actually changes", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    emitAuth("SIGNED_IN", mkSession("u3", "a@example.com"));
    await waitFor(() => expect(screen.getByTestId("userId").textContent).toBe("u3"));
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(1));

    emitAuth("SIGNED_IN", mkSession("u4", "b@example.com"));
    await waitFor(() => expect(screen.getByTestId("userId").textContent).toBe("u4"));
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(2));
  });
});

describe("AuthContext granular roles (Module 3 RBAC)", () => {
  it("exposes all roles returned by get_user_roles, not just admin", async () => {
    rpcMock.mockResolvedValue({ data: ["admin", "moderator"], error: null });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    emitAuth("SIGNED_IN", mkSession("u5", "staff@example.com"));
    await waitFor(() => expect(screen.getByTestId("adminChecked").textContent).toBe("true"));
    expect(screen.getByTestId("roles").textContent).toBe("admin,moderator");
    expect(screen.getByTestId("isAdmin").textContent).toBe("true");
  });

  it("derives isAdmin=false for a moderator-only user (RBAC is not all-or-nothing)", async () => {
    rpcMock.mockResolvedValue({ data: ["moderator"], error: null });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    emitAuth("SIGNED_IN", mkSession("u6", "mod@example.com"));
    await waitFor(() => expect(screen.getByTestId("adminChecked").textContent).toBe("true"));
    expect(screen.getByTestId("roles").textContent).toBe("moderator");
    expect(screen.getByTestId("isAdmin").textContent).toBe("false");
  });

  it("gives a plain customer an empty roles array", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    emitAuth("SIGNED_IN", mkSession("u7", "shopper2@example.com"));
    await waitFor(() => expect(screen.getByTestId("adminChecked").textContent).toBe("true"));
    expect(screen.getByTestId("roles").textContent).toBe("");
    expect(screen.getByTestId("isAdmin").textContent).toBe("false");
  });

  it("the owner fast-path still sets roles=['admin'] without an RPC call", async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    emitAuth("SIGNED_IN", mkSession("u8", "biz.arprimemarket@gmail.com"));
    await waitFor(() => expect(screen.getByTestId("adminChecked").textContent).toBe("true"));
    expect(screen.getByTestId("roles").textContent).toBe("admin");
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
