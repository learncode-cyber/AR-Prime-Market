import { lazy, Suspense, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Loader2, Mail, MessageCircle, MessagesSquare, X } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "@tanstack/react-router";
import { useAiOpen } from "@/lib/ai-stack";

const ChatWidget = lazy(() =>
  import("@/components/ChatWidget").then((m) => ({ default: m.ChatWidget })),
);

const preloadChatWidget = () => {
  void import("@/components/ChatWidget");
};

const smoothTransition = (delay = 0) => ({
  type: "tween" as const,
  ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
  duration: 0.22,
  delay,
});

export const FloatingWhatsApp = () => {
  const [showScroll, setShowScroll] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const aiOpen = useAiOpen();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/kali_master");

  useEffect(() => {
    const onScroll = () => setShowScroll(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close menu whenever AI panel opens
  useEffect(() => {
    if (aiOpen) setMenuOpen(false);
  }, [aiOpen]);

  const handleWhatsApp = () => {
    const waText = encodeURIComponent(
      "🚀 [AR Prime Market Support Request] 🛒\n\nHello AR Prime Market Team,\n\nI am interested in a product/service from your site. Here are my details:\n\n- Topic: [Type your query here]\n- Platform: Prime Market Web\n\nLooking forward to a quick chat! Thanks.",
    );
    window.open(`https://wa.me/8801910521565?text=${waText}`, "_blank");
    setMenuOpen(false);
  };

  const handleChat = () => {
    setShowChat(true);
    setMenuOpen(false);
  };

  const handleEmail = () => {
    const email = "info@arprimemarket.shop";
    const subject = "🛒 Order/Inquiry: [AR Prime Market] - Customer Support Request";
    const body =
      "Hello AR Prime Market Support,\n\nI am reaching out via Prime Market regarding the following:\n\n📌 Inquiry Detail: [Please describe your problem or question here]\n📍 Site URL: arprimemarket.shop\n\nPlease let me know how you can help.\n\nBest regards.";
    navigator.clipboard.writeText(email).catch(() => {});
    toast.success("Opening Gmail... Address copied to clipboard!");
    const ua = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (ua)
      window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    else
      window.open(
        `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
        "_blank",
      );
    setMenuOpen(false);
  };

  const stackHidden = aiOpen;

  const menuItems = [
    {
      key: "email",
      label: "Email",
      icon: Mail,
      onClick: handleEmail,
      onHover: undefined as undefined | (() => void),
      className: "bg-white text-foreground border border-border",
    },
    {
      key: "whatsapp",
      label: "WhatsApp",
      icon: MessageCircle,
      onClick: handleWhatsApp,
      onHover: undefined as undefined | (() => void),
      className: "bg-[#25D366] text-white",
    },
    {
      key: "chat",
      label: "Live Chat",
      icon: MessagesSquare,
      onClick: handleChat,
      onHover: preloadChatWidget,
      className: "bg-[#EC4899] text-white",
    },
  ];

  if (isAdminRoute) return null;

  return (
    <>
      {/* Raiyan AI emoji FAB with expandable menu (WhatsApp / Live Chat / Email) */}
      <AnimatePresence>
        {!stackHidden && (
          <motion.div
            key="raiyan-stack"
            initial={{ opacity: 0, scale: 0.8, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 12 }}
            transition={smoothTransition(0.04)}
            className="fixed bottom-20 right-5 sm:bottom-24 sm:right-6 z-[20]"
          >
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="absolute bottom-full right-0 mb-3 flex flex-col items-end gap-2"
                >
                  {menuItems.map((item, i) => (
                    <motion.button
                      key={item.key}
                      initial={{ opacity: 0, x: 12, scale: 0.9 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: 12, scale: 0.9 }}
                      transition={{ duration: 0.18, delay: (menuItems.length - 1 - i) * 0.04 }}
                      onClick={item.onClick}
                      onMouseEnter={item.onHover}
                      onTouchStart={item.onHover}
                      className="flex items-center gap-2 rounded-full pl-3 pr-4 py-2 shadow-lg backdrop-blur-xl touch-manipulation"
                    >
                      <span
                        className={`flex h-10 w-10 items-center justify-center rounded-full shadow-md ${item.className}`}
                      >
                        <item.icon className="h-4 w-4" />
                      </span>
                      <span className="text-xs font-semibold text-foreground bg-card/90 border border-border rounded-md px-2 py-1 shadow-sm min-w-[72px] text-center">
                        {item.label}
                      </span>
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={() => setMenuOpen((v) => !v)}
              className={`flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full text-white shadow-[0_8px_24px_-4px_rgba(236,72,153,0.5)] backdrop-blur-xl transition-all touch-manipulation hover:scale-105 active:scale-95 ${menuOpen ? "bg-[#DB2777] border border-[#EC4899]/40" : "bg-[#EC4899] border border-[#EC4899]/60 hover:bg-[#DB2777]"}`}
              aria-label="Contact options"
              aria-expanded={menuOpen}
              title="Contact us"
            >
              <AnimatePresence mode="wait" initial={false}>
                {menuOpen ? (
                  <motion.span
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <X className="h-4 w-4 sm:h-5 sm:w-5" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="emoji"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="text-xl sm:text-2xl leading-none"
                    aria-hidden="true"
                  >
                    👨‍💻
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scroll-to-top — hides whenever Raiyan menu expands or AI panel opens */}
      <AnimatePresence>
        {showScroll && !menuOpen && !aiOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "tween", ease: "easeOut", duration: 0.2 }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-[8.75rem] right-5 sm:bottom-[9.5rem] sm:right-6 z-[18] flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full border border-border/40 bg-secondary/90 text-foreground shadow-md backdrop-blur-xl hover:bg-accent touch-manipulation"
            aria-label="Scroll to top"
          >
            <ArrowUp className="h-4 w-4 sm:h-5 sm:w-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Raiyan chat modal */}
      <AnimatePresence>
        {showChat && (
          <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowChat(false)}
              className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.96 }}
              className="relative z-10 max-h-[80vh] w-full max-w-md overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-2xl shadow-primary/20"
            >
              <div className="flex items-center justify-between border-b border-primary/15 bg-primary/5 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">👨‍💻</span>
                  <span className="font-display text-sm font-bold">Raiyan</span>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                </div>
                <button
                  type="button"
                  onClick={() => setShowChat(false)}
                  className="rounded-lg p-1.5 transition-colors hover:bg-secondary"
                  aria-label="Close chat"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <div className="h-[60vh] overflow-y-auto">
                <Suspense
                  fallback={
                    <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading chat…
                    </div>
                  }
                >
                  <ChatWidget embedded />
                </Suspense>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
