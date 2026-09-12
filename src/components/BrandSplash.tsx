import { useEffect, useRef, useState } from "react";
import splashCartAsset from "@/assets/ar-prime-market-logo.png.asset.json";
const splashCart = splashCartAsset.url;

/**
 * BrandSplash — smooth 3D AR shopping cart loading screen.
 * Gentle float + glow pulse, gradient wordmark, bouncing dots.
 */
export function BrandSplash({ show }: { show: boolean }) {
  const [mounted, setMounted] = useState(show);
  const [fadingOut, setFadingOut] = useState(false);
  const fadeTimer = useRef<number | null>(null);

  useEffect(() => {
    if (show) {
      if (fadeTimer.current) {
        window.clearTimeout(fadeTimer.current);
        fadeTimer.current = null;
      }
      setMounted(true);
      requestAnimationFrame(() => setFadingOut(false));
    } else if (mounted) {
      setFadingOut(true);
      fadeTimer.current = window.setTimeout(() => {
        setMounted(false);
        setFadingOut(false);
        fadeTimer.current = null;
      }, 450);
    }
    return () => {
      if (fadeTimer.current) {
        window.clearTimeout(fadeTimer.current);
        fadeTimer.current = null;
      }
    };
  }, [show, mounted]);

  if (!mounted) return null;

  return (
    <div
      aria-hidden="true"
      role="status"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background"
      style={{
        opacity: fadingOut ? 0 : 1,
        transition: "opacity 450ms ease-out",
        pointerEvents: fadingOut ? "none" : "auto",
      }}
    >
      <style>{`
        @keyframes splashCartFloat {
          0%, 100% { transform: translateY(0) rotate(-1.5deg); }
          50%      { transform: translateY(-14px) rotate(1.5deg); }
        }
        @keyframes splashGlowPulse {
          0%, 100% { opacity: 0.45; transform: scale(0.9); }
          50%      { opacity: 0.85; transform: scale(1.05); }
        }
        @keyframes splashWordPulse {
          0%, 100% { opacity: 0.7; letter-spacing: 0.34em; }
          50%      { opacity: 1;   letter-spacing: 0.42em; }
        }
        @keyframes splashDotBounce {
          0%, 80%, 100% { transform: translateY(0) scale(0.8); opacity: 0.4; }
          40%           { transform: translateY(-10px) scale(1); opacity: 1; }
        }
        .splash-cart-wrap {
          position: relative;
          width: min(62vw, 260px);
          aspect-ratio: 1 / 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .splash-cart-glow {
          position: absolute;
          inset: -10%;
          border-radius: 9999px;
          background: radial-gradient(circle, rgba(225,29,116,0.35) 0%, rgba(167,85,255,0.18) 45%, rgba(225,29,116,0) 70%);
          filter: blur(20px);
          animation: splashGlowPulse 2.4s ease-in-out infinite;
          will-change: opacity, transform;
        }
        .splash-cart-img {
          position: relative;
          width: 100%;
          height: 100%;
          object-fit: contain;
          animation: splashCartFloat 3s ease-in-out infinite;
          will-change: transform;
          filter: drop-shadow(0 18px 30px rgba(225,29,116,0.28));
        }
        .splash-word {
          margin-top: 1.6rem;
          font-family: var(--font-display, "Plus Jakarta Sans"), system-ui, sans-serif;
          font-weight: 700;
          font-size: 0.82rem;
          text-transform: uppercase;
          background: linear-gradient(90deg, #C8A23F 0%, #E11D74 50%, #C8A23F 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: splashWordPulse 1.8s ease-in-out infinite;
        }
        .splash-dots {
          display: flex;
          gap: 8px;
          margin-top: 1.1rem;
        }
        .splash-dot {
          width: 9px;
          height: 9px;
          border-radius: 9999px;
          background: linear-gradient(135deg, #E11D74, #C8A23F);
          animation: splashDotBounce 1.2s ease-in-out infinite;
        }
        .splash-dot:nth-child(2) { animation-delay: 0.15s; }
        .splash-dot:nth-child(3) { animation-delay: 0.3s; }
        @media (prefers-reduced-motion: reduce) {
          .splash-cart-img,
          .splash-cart-glow,
          .splash-word,
          .splash-dot { animation: none; }
          .splash-cart-glow { opacity: 0.4; }
        }
      `}</style>

      <div className="splash-cart-wrap">
        <div className="splash-cart-glow" />
        <img
          src={splashCart}
          alt=""
          width={1024}
          height={1024}
          className="splash-cart-img"
          draggable={false}
        />
      </div>

      <div className="splash-word">AR Prime Market</div>

      <div className="splash-dots" aria-label="Loading">
        <span className="splash-dot" />
        <span className="splash-dot" />
        <span className="splash-dot" />
      </div>
    </div>
  );
}
