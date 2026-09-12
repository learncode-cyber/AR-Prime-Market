import { useState } from "react";
import { Copy, Download, X, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export function RecoveryCodesModal({
  codes,
  onClose,
  title = "Save your recovery codes",
  intro = "Store these somewhere safe. Each code can be used once to sign in if you lose access to your authenticator. You won't see them again.",
}: {
  codes: string[];
  onClose: () => void;
  title?: string;
  intro?: string;
}) {
  const [acknowledged, setAcknowledged] = useState(false);

  const copyAll = () => {
    navigator.clipboard.writeText(codes.join("\n"));
    toast.success("Recovery codes copied");
  };

  const download = () => {
    const blob = new Blob(
      [
        `AR Prime Market — Two-factor recovery codes\nGenerated ${new Date().toISOString()}\n\n${codes.join("\n")}\n`,
      ],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h3 className="font-display font-bold text-foreground">{title}</h3>
          </div>
          <button
            onClick={onClose}
            disabled={!acknowledged}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex gap-2 p-3 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{intro}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 p-4 rounded-xl bg-background border border-border font-mono text-sm">
            {codes.map((c) => (
              <div
                key={c}
                className="px-2 py-1.5 rounded bg-secondary/50 text-center tracking-wider"
              >
                {c}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={copyAll}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-secondary"
            >
              <Copy className="w-4 h-4" /> Copy
            </button>
            <button
              type="button"
              onClick={download}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-secondary"
            >
              <Download className="w-4 h-4" /> Download
            </button>
          </div>

          <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5"
            />
            <span>I've saved these codes in a secure place.</span>
          </label>

          <button
            onClick={onClose}
            disabled={!acknowledged}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
