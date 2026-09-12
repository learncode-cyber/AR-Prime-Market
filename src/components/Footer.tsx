import { Link } from "@tanstack/react-router";
import { Mail, MapPin, Phone } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { SocialLinksRow } from "./SocialLinks";
import {
  VisaIcon,
  MastercardIcon,
  BinancePayIcon,
  BkashIcon,
  NagadIcon,
  CodIcon,
} from "./PaymentIcons";
import { toast } from "sonner";
import arQudrixLogo from "@/assets/arqudrix-logo.jpg";

const paymentMethods = [
  { icon: VisaIcon, label: "Visa" },
  { icon: MastercardIcon, label: "Mastercard" },
  { icon: BkashIcon, label: "bKash" },
  { icon: NagadIcon, label: "Nagad" },
  { icon: BinancePayIcon, label: "Binance Pay" },
  { icon: CodIcon, label: "Cash on Delivery" },
];

export const Footer = () => {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const { t } = useLanguage();
  const blogEnabled = useFeatureFlag("blog");

  const brandName = "Prime Market";
  const brandDesc = t("brandDesc");

  const footerSections = {
    [t("about")]: [
      { label: t("ourStory"), href: "/about" },
      { label: t("careers"), href: "/careers" },
      ...(blogEnabled ? [{ label: t("blog"), href: "/blog" }] : []),
    ],
    [t("supportNav")]: [
      { label: t("returnsRefunds"), href: "/refund-policy" },
      { label: t("trackOrder"), href: "/track-order" },
      { label: t("contactUs"), href: "/contact" },
    ],
    [t("policies")]: [
      { label: t("privacyPolicy"), href: "/privacy-policy" },
      { label: t("termsOfService"), href: "/terms" },
      { label: t("cookiePolicy"), href: "/cookie-policy" },
    ],
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    toast.success("Subscribed successfully! 🎉");
    setSubscribed(true);
    setEmail("");
    setTimeout(() => setSubscribed(false), 3000);
  };

  return (
    <footer className="border-t border-border bg-gradient-to-b from-card to-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/3 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
      </div>

      {/* Newsletter */}
      <div
        data-subscribe-section
        className="relative bg-gradient-to-r from-primary/8 via-primary/5 to-primary/8 border-b border-border/50"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 items-center justify-center shrink-0 shadow-sm">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h4 className="font-display font-bold text-sm sm:text-base text-foreground">
                {t("getExclusiveDeals")}
              </h4>
              <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
                {t("subscribeDesc")}
              </p>
            </div>
          </div>
          <form onSubmit={handleSubscribe} className="flex w-full sm:w-auto gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("enterEmail")}
              className="flex-1 sm:w-60 px-4 py-2.5 rounded-xl border border-border/60 bg-background/80 backdrop-blur-sm text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all shadow-sm"
              required
            />
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs sm:text-sm transition-all hover:brightness-110 active:scale-[0.97] touch-manipulation whitespace-nowrap"
            >
              {subscribed ? "✓ " + t("subscribed") : t("subscribe")}
            </button>
          </form>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 md:gap-8">
          <div className="col-span-2 space-y-5">
            <Link to="/" className="inline-flex items-center gap-2 group">
              <span className="font-display font-bold text-lg text-foreground">{brandName}</span>
            </Link>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">{brandDesc}</p>
            <div className="space-y-2.5">
              <a
                href="mailto:info@arprimemarket.shop"
                className="flex items-center gap-2.5 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-secondary">
                  <Mail className="w-3.5 h-3.5" />
                </span>
                info@arprimemarket.shop
              </a>
              <a
                href="tel:+8801910521565"
                className="flex items-center gap-2.5 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-secondary">
                  <Phone className="w-3.5 h-3.5" />
                </span>
                +880 1910-521565
              </a>
              <span className="flex items-center gap-2.5 text-xs text-muted-foreground">
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-secondary">
                  <MapPin className="w-3.5 h-3.5" />
                </span>
                Dhaka, Bangladesh
              </span>
            </div>
            <div className="pt-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-2.5">
                Follow Us
              </p>
              <SocialLinksRow size="md" variant="branded" />
            </div>
          </div>

          {Object.entries(footerSections).map(([title, links]) => (
            <div key={title}>
              <h4 className="font-display font-bold text-xs text-foreground uppercase tracking-widest mb-4 relative">
                {title}
                <span className="absolute -bottom-1.5 left-0 w-6 h-0.5 bg-primary/40 rounded-full" />
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.href as string}
                      className="text-xs text-muted-foreground hover:text-primary transition-all duration-200 inline-block touch-manipulation"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Parent company / ownership block */}
        <div className="mt-10 sm:mt-14 pt-8 border-t border-border/50">
          <div className="flex items-center justify-center gap-3 max-w-xl mx-auto text-center">
            <img
              src={arQudrixLogo}
              alt="AR Qudrix"
              className="shrink-0 w-10 h-10 rounded-xl object-contain bg-background border border-border/60 p-1 shadow-sm"
              loading="lazy"
            />
            <div className="text-left">
              <p className="text-xs sm:text-sm text-foreground font-semibold">
                An AR Qudrix Company
              </p>
              <p className="mt-0.5 text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                AR Prime Market is owned and operated by AR Qudrix.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 sm:mt-12 pt-6 border-t border-border/50">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="text-[11px] text-muted-foreground mr-1 font-medium">
                {t("weAccept")}
              </span>
              {paymentMethods.map((pm) => (
                <div
                  key={pm.label}
                  className="rounded-md overflow-hidden shadow-sm border border-border/20"
                  title={pm.label}
                >
                  <pm.icon className="w-9 h-6 sm:w-12 sm:h-8" />
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">{t("allRightsReserved")}</p>
            <p className="text-[10px] text-muted-foreground/80">
              © {new Date().getFullYear()} AR Qudrix. All rights reserved. AR Prime Market™ is a
              trademark of AR Qudrix.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};
