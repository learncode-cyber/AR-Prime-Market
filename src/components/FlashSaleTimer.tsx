import { useState, useEffect } from "react";
import { Zap, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

const TimeBlock = ({ value, label }: { value: number; label: string }) => (
  <div className="flex flex-col items-center">
    <div className="bg-foreground/10 backdrop-blur-sm rounded-xl w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center">
      <span className="font-display text-lg sm:text-xl font-bold text-primary-foreground tabular-nums">
        {String(value).padStart(2, "0")}
      </span>
    </div>
    <span className="text-[9px] sm:text-[10px] text-primary-foreground/60 mt-1 uppercase tracking-wider">
      {label}
    </span>
  </div>
);

const FlashSaleTimer = () => {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (now === null) return null;

  // Default flash sale: ends 3 days from now (recalculated daily)
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + 3);
  endDate.setHours(23, 59, 59, 0);

  const diff = endDate.getTime() - now;
  if (diff <= 0) return null;

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-primary via-primary/90 to-primary/70">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary-foreground/5 blur-3xl animate-pulse" />
          <div
            className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-primary-foreground/5 blur-3xl animate-pulse"
            style={{ animationDelay: "1s" }}
          />
        </div>

        <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4 p-4 sm:p-6">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="hidden sm:flex w-10 h-10 rounded-xl bg-primary-foreground/10 items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <Zap className="w-3.5 h-3.5 text-primary-foreground sm:hidden" />
                <span className="text-[10px] uppercase tracking-widest text-primary-foreground/70 font-semibold">
                  Flash Sale
                </span>
              </div>
              <h3 className="font-display text-base sm:text-lg font-bold text-primary-foreground mt-0.5">
                Mega Flash Sale — Up to 50% OFF
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {days > 0 && (
              <>
                <TimeBlock value={days} label="Days" />
                <span className="text-primary-foreground/40 font-bold text-lg mb-4">:</span>
              </>
            )}
            <TimeBlock value={hours} label="Hrs" />
            <span className="text-primary-foreground/40 font-bold text-lg mb-4">:</span>
            <TimeBlock value={minutes} label="Min" />
            <span className="text-primary-foreground/40 font-bold text-lg mb-4">:</span>
            <TimeBlock value={seconds} label="Sec" />
          </div>

          <Link to="/products" className="shrink-0">
            <span className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary-foreground text-primary font-semibold text-xs sm:text-sm transition-all hover:brightness-95 active:scale-[0.97] touch-manipulation">
              Shop Now <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default FlashSaleTimer;
