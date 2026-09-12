import { Link } from "@tanstack/react-router";
import { ShoppingBag, Sparkles, ShieldCheck, Truck } from "lucide-react";
import type { ReactNode } from "react";
import { PoweredByQudrix } from "@/components/PoweredByQudrix";

interface Props {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthShell({ title, subtitle, children, footer }: Props) {
  return (
    <div className="min-h-[calc(100vh-4rem)] grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden lg:flex relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/70 text-primary-foreground p-12 flex-col justify-between">
        <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_20%_20%,white,transparent_50%),radial-gradient(circle_at_80%_80%,white,transparent_45%)]" />
        <div className="relative">
          <Link to="/" className="flex items-center gap-2 text-2xl font-display font-extrabold">
            <ShoppingBag className="w-7 h-7" /> AR Prime Market
          </Link>
        </div>
        <div className="relative space-y-6">
          <h2 className="font-display font-bold text-4xl leading-tight">
            Curated essentials.
            <br />
            Delivered worldwide.
          </h2>
          <p className="text-primary-foreground/85 max-w-md">
            Join thousands of shoppers enjoying premium products with worldwide shipping, secure
            checkout and round-the-clock support.
          </p>
          <ul className="space-y-3 pt-2">
            {[
              { icon: Sparkles, text: "Hand-picked premium catalog" },
              { icon: Truck, text: "Fast international shipping" },
              { icon: ShieldCheck, text: "Secure checkout & buyer protection" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-primary-foreground/90">
                <span className="w-8 h-8 rounded-full bg-primary-foreground/15 flex items-center justify-center">
                  <Icon className="w-4 h-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative flex items-center justify-between text-xs text-primary-foreground/70">
          <span>© {new Date().getFullYear()} AR Prime Market</span>
          <span className="text-[10px] uppercase tracking-widest opacity-80">
            An AR Qudrix Company
          </span>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-10 bg-background">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-6 text-center flex flex-col items-center gap-2">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-lg font-display font-bold text-foreground"
            >
              <ShoppingBag className="w-5 h-5 text-primary" /> AR Prime Market
            </Link>
            <PoweredByQudrix variant="company" />
          </div>

          <div className="space-y-1.5 mb-6">
            <h1 className="font-display font-bold text-2xl sm:text-3xl text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
          {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
