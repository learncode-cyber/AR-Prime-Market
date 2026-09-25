import { useState } from "react";
import { Check, Loader2, Trash2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AVATAR_PRESETS } from "@/lib/avatar-presets";

interface Props {
  userId: string;
  avatarUrl: string | null;
  fullName?: string | null;
  onChange: (url: string | null) => void;
  size?: "lg" | "md";
}

export function AvatarUploader({ userId, avatarUrl, fullName, onChange, size = "lg" }: Props) {
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"boys" | "girls">("boys");

  const dim = size === "lg" ? "w-28 h-28 sm:w-32 sm:h-32" : "w-16 h-16";
  const initials = (fullName || "U")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const setAvatar = async (url: string | null) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: url } as any)
        .eq("id", userId);
      if (error) throw error;
      onChange(url);
      toast.success(url ? "Avatar updated" : "Avatar removed");
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || "Failed to update avatar");
    } finally {
      setSaving(false);
    }
  };

  const presets = AVATAR_PRESETS.filter((a) => a.group === tab);

  return (
    <div className="space-y-5">
      {/* Current avatar preview */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative inline-block">
          <div
            className={`${dim} rounded-full overflow-hidden ring-4 ring-background shadow-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center relative`}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : initials !== "U" ? (
              <span className="font-display font-bold text-3xl sm:text-4xl text-primary">
                {initials}
              </span>
            ) : (
              <User className="w-12 h-12 text-primary/60" />
            )}
            {saving && (
              <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            )}
          </div>
          {avatarUrl && (
            <button
              type="button"
              onClick={() => setAvatar(null)}
              disabled={saving}
              aria-label="Remove avatar"
              className="absolute top-0 right-0 w-7 h-7 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md hover:scale-110 transition-transform disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground text-center max-w-xs">
          Choose an avatar from our presets. No image uploads required.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 justify-center">
        {(["boys", "girls"] as const).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setTab(g)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${
              tab === g
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Preset grid */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {presets.map((preset) => {
          const selected = avatarUrl === preset.url;
          return (
            <button
              key={preset.id}
              type="button"
              disabled={saving}
              onClick={() => setAvatar(preset.url)}
              aria-label={`Choose ${preset.label}`}
              className={`relative aspect-square rounded-full overflow-hidden bg-secondary transition-all hover:scale-105 disabled:opacity-50 ${
                selected ? "ring-4 ring-primary shadow-lg" : "ring-2 ring-border"
              }`}
            >
              <img
                src={preset.url}
                alt={preset.label}
                width={512}
                height={512}
                loading="lazy"
                className="w-full h-full object-cover"
              />
              {selected && (
                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                  <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <Check className="w-4 h-4" />
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
