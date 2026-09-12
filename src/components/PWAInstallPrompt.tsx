import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

const DISMISS_KEY = "ar-pm-pwa-install-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PWAInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    // Hide if already installed (standalone)
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      window.setTimeout(() => setShow(true), 4000);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      localStorage.setItem(DISMISS_KEY, "installed");
    }
    setShow(false);
    setDeferred(null);
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-24 left-4 sm:left-6 z-[25] max-w-[300px] animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="relative flex items-start gap-3 rounded-2xl bg-white p-4 shadow-[0_10px_40px_-8px_rgba(0,0,0,0.15)] border border-pink-100">
        <button
          onClick={dismiss}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pink-50">
          <Download className="h-5 w-5 text-[#EC4899]" />
        </div>
        <div className="flex-1 pr-4">
          <h3 className="text-sm font-bold text-gray-900">Install AR Prime</h3>
          <p className="mt-0.5 text-xs text-gray-500 leading-snug">
            Add to home screen for a better experience
          </p>
          <button
            onClick={install}
            className="mt-3 inline-flex items-center justify-center rounded-full bg-[#EC4899] px-5 py-2 text-xs font-semibold text-white shadow-[0_4px_14px_-2px_rgba(236,72,153,0.5)] transition-all hover:bg-[#DB2777] hover:scale-105 active:scale-100"
          >
            Install App
          </button>
        </div>
      </div>
    </div>
  );
}
