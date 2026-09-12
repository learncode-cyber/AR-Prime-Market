import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth/callback")({
  validateSearch: (search: Record<string, unknown>) => ({
    next: typeof search.next === "string" ? (search.next as string) : undefined,
  }),
  head: () => ({
    meta: [{ title: "Signing you in…" }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: AuthCallback,
});

function AuthCallback() {
  const { user, isAdmin, adminChecked, loading } = useAuth();
  const navigate = useNavigate();
  const { next } = Route.useSearch();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (!adminChecked) return;
    // Admin allowlist match → admin console. Otherwise → account (or explicit ?next).
    if (isAdmin) {
      navigate({ to: "/kali_master" });
    } else {
      navigate({ to: next || "/account" });
    }
  }, [user, isAdmin, adminChecked, loading, navigate, next]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
      <p className="text-sm">Finishing sign-in…</p>
    </div>
  );
}
