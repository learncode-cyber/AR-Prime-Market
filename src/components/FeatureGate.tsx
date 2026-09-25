import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";

interface Props {
  flag: string;
  children: React.ReactNode;
  /** Render-prop fallback. Defaults to a friendly "feature unavailable" screen. */
  fallback?: React.ReactNode;
  /** If true, render nothing when disabled (useful for nav links / inline buttons). */
  silent?: boolean;
}

export function FeatureGate({ flag, children, fallback, silent }: Props) {
  const enabled = useFeatureFlag(flag);
  if (enabled) return <>{children}</>;
  if (silent) return null;
  if (fallback) return <>{fallback}</>;
  return (
    <div className="max-w-md mx-auto text-center py-24 px-6">
      <div className="w-16 h-16 rounded-full bg-secondary mx-auto mb-4 flex items-center justify-center">
        <Lock className="w-7 h-7 text-muted-foreground" />
      </div>
      <h1 className="text-xl font-display font-bold mb-2">Feature unavailable</h1>
      <p className="text-sm text-muted-foreground mb-6">
        This section is temporarily disabled. Please check back later.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        Back to Home
      </Link>
    </div>
  );
}
