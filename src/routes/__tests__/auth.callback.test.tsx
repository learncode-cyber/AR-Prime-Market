import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

// --- Mocks must be declared before importing the component under test. ---
const navigateMock = vi.fn();
const authState: {
  user: { id: string; email: string } | null;
  isAdmin: boolean;
  adminChecked: boolean;
  loading: boolean;
} = {
  user: null,
  isAdmin: false,
  adminChecked: false,
  loading: true,
};
let searchMock: { next?: string } = {};

vi.mock("@tanstack/react-router", () => {
  const createFileRoute = () => (config: unknown) => config;
  return {
    createFileRoute,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => authState,
}));

// Now import — the module evaluates the createFileRoute mock and exposes
// `Route` whose `useSearch` we override per test.
import { Route } from "@/routes/auth.callback";

const Component = (Route as unknown as { component: React.ComponentType }).component;

// Patch the Route object so `Route.useSearch()` works inside the component.
(Route as unknown as { useSearch: () => typeof searchMock }).useSearch = () => searchMock;

describe("/auth/callback redirect logic", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    searchMock = {};
    authState.user = null;
    authState.isAdmin = false;
    authState.adminChecked = false;
    authState.loading = true;
    cleanup();
  });

  it("does NOT navigate while auth is still loading", () => {
    authState.loading = true;
    render(<Component />);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated users to /login", () => {
    authState.loading = false;
    authState.user = null;
    authState.adminChecked = true;
    render(<Component />);
    expect(navigateMock).toHaveBeenCalledWith({ to: "/login" });
  });

  it("waits for adminChecked before deciding the destination", () => {
    authState.loading = false;
    authState.user = { id: "u1", email: "x@y.z" };
    authState.adminChecked = false;
    render(<Component />);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("admin allowlist match → /kali_master", () => {
    authState.loading = false;
    authState.user = { id: "u1", email: "biz.arprimemarket@gmail.com" };
    authState.isAdmin = true;
    authState.adminChecked = true;
    render(<Component />);
    expect(navigateMock).toHaveBeenCalledWith({ to: "/kali_master" });
  });

  it("non-admin user → /account by default", () => {
    authState.loading = false;
    authState.user = { id: "u2", email: "shopper@example.com" };
    authState.isAdmin = false;
    authState.adminChecked = true;
    render(<Component />);
    expect(navigateMock).toHaveBeenCalledWith({ to: "/account" });
  });

  it("non-admin user → explicit ?next destination when provided", () => {
    authState.loading = false;
    authState.user = { id: "u3", email: "shopper@example.com" };
    authState.isAdmin = false;
    authState.adminChecked = true;
    searchMock = { next: "/wishlist" };
    render(<Component />);
    expect(navigateMock).toHaveBeenCalledWith({ to: "/wishlist" });
  });

  it("admin user ignores ?next and still goes to /kali_master", () => {
    authState.loading = false;
    authState.user = { id: "u4", email: "biz.arprimemarket@gmail.com" };
    authState.isAdmin = true;
    authState.adminChecked = true;
    searchMock = { next: "/wishlist" };
    render(<Component />);
    expect(navigateMock).toHaveBeenCalledWith({ to: "/kali_master" });
  });
});
