import { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  redirectPath?: string;
  label?: string;
  className?: string;
}

export function FacebookSignInButton({
  redirectPath,
  label = "Continue with Facebook",
  className = "",
}: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const next = redirectPath && redirectPath !== "/kali_master" ? redirectPath : undefined;
      const redirectTo = `${origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "facebook",
        options: { redirectTo },
      });
      if (error) {
        toast.error(error.message);
        setLoading(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Facebook sign-in failed");
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`w-full inline-flex items-center justify-center gap-2.5 py-3 rounded-xl border border-border bg-card text-foreground font-medium text-sm hover:bg-secondary/60 transition-colors disabled:opacity-60 ${className}`}
      aria-label={label}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#1877F2"
            d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.412c0-3.017 1.792-4.683 4.533-4.683 1.312 0 2.686.236 2.686.236v2.97h-1.514c-1.491 0-1.956.93-1.956 1.886v2.262h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"
          />
        </svg>
      )}
      <span>{label}</span>
    </button>
  );
}
