import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Settings,
  BarChart3,
  Tag,
  MessageSquare,
  ArrowLeft,
  Ticket,
  Layout,
  Rocket,
  CreditCard,
  Truck,
  Factory,
  Languages,
  RotateCcw,
  Headphones,
  Activity,
  Download,
  KeyRound,
  Image as ImageIcon,
  Sparkles,
  ToggleRight,
  Search,
  ShieldAlert,
  Users,
  MoreHorizontal,
  Bot,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type AdminLink = {
  label: string;
  href:
    | "/kali_master"
    | "/kali_master/dropshipping"
    | "/kali_master/products"
    | "/kali_master/importer"
    | "/kali_master/api-keys"
    | "/kali_master/imgbb"
    | "/kali_master/image-optimization"
    | "/kali_master/orders"
    | "/kali_master/returns"
    | "/kali_master/support"
    | "/kali_master/customers"
    | "/kali_master/categories"
    | "/kali_master/coupons"
    | "/kali_master/payment-methods"
    | "/kali_master/shipping-rates"
    | "/kali_master/suppliers"
    | "/kali_master/translations"
    | "/kali_master/content"
    | "/kali_master/marketing-ai-hub"
    | "/kali_master/reviews"
    | "/kali_master/analytics"
    | "/kali_master/seo-audit"
    | "/kali_master/audit-log"
    | "/kali_master/feature-flags"
    | "/kali_master/settings"
    | "/kali_master/status"
    | "/kali_master/ai-agent";
  icon: typeof LayoutDashboard;
};

const primaryTabs: AdminLink[] = [
  { label: "Dashboard", href: "/kali_master", icon: LayoutDashboard },
  { label: "Dropship", href: "/kali_master/dropshipping", icon: Factory },
  { label: "Products", href: "/kali_master/products", icon: Package },
  { label: "Orders", href: "/kali_master/orders", icon: ShoppingCart },
];

const moreLinks: AdminLink[] = [
  { label: "Importer", href: "/kali_master/importer", icon: Download },
  { label: "API Keys", href: "/kali_master/api-keys", icon: KeyRound },
  { label: "ImgBB Key", href: "/kali_master/imgbb", icon: ImageIcon },
  { label: "Image Opt", href: "/kali_master/image-optimization", icon: Sparkles },
  { label: "Returns", href: "/kali_master/returns", icon: RotateCcw },
  { label: "Support", href: "/kali_master/support", icon: Headphones },
  { label: "Customers", href: "/kali_master/customers", icon: Users },
  { label: "Categories", href: "/kali_master/categories", icon: Tag },
  { label: "Coupons", href: "/kali_master/coupons", icon: Ticket },
  { label: "Payments", href: "/kali_master/payment-methods", icon: CreditCard },
  { label: "Shipping", href: "/kali_master/shipping-rates", icon: Truck },
  { label: "Suppliers", href: "/kali_master/suppliers", icon: Factory },
  { label: "Translations", href: "/kali_master/translations", icon: Languages },
  { label: "Content", href: "/kali_master/content", icon: Layout },
  { label: "AI Agent", href: "/kali_master/ai-agent", icon: Bot },
  { label: "Marketing", href: "/kali_master/marketing-ai-hub", icon: Rocket },
  { label: "Reviews", href: "/kali_master/reviews", icon: MessageSquare },
  { label: "Analytics", href: "/kali_master/analytics", icon: BarChart3 },
  { label: "SEO Audit", href: "/kali_master/seo-audit", icon: Search },
  { label: "Audit Log", href: "/kali_master/audit-log", icon: ShieldAlert },
  { label: "Flags", href: "/kali_master/feature-flags", icon: ToggleRight },
  { label: "Settings", href: "/kali_master/settings", icon: Settings },
  { label: "Status", href: "/kali_master/status", icon: Activity },
];

function TabLink({ link }: { link: AdminLink }) {
  return (
    <Link
      to={link.href}
      preload="intent"
      activeOptions={{ exact: link.href === "/kali_master" }}
      activeProps={{
        className: "text-primary bg-primary/10 [&>svg]:text-primary",
      }}
      className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 px-2 rounded-xl text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
    >
      <link.icon className="w-5 h-5" />
      <span className="leading-none">{link.label}</span>
    </Link>
  );
}

export function AdminBottomDock() {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <nav
      aria-label="Admin navigation"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 shadow-[0_-4px_24px_-12px_hsl(var(--primary)/0.25)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      <div className="mx-auto flex max-w-3xl items-stretch justify-around gap-1 px-2 py-1.5">
        {primaryTabs.map((link) => (
          <TabLink key={link.href} link={link} />
        ))}

        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 px-2 rounded-xl text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <MoreHorizontal className="w-5 h-5" />
              <span className="leading-none">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-2xl">
            <SheetHeader className="text-left">
              <SheetTitle>All admin tools</SheetTitle>
            </SheetHeader>
            <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 pb-6">
              <Link
                to="/"
                preload="intent"
                onClick={() => setMoreOpen(false)}
                className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl border border-border bg-card hover:bg-secondary/60 text-xs text-foreground transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-primary" />
                <span className="text-center leading-tight">Back to Store</span>
              </Link>
              {moreLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  preload="intent"
                  onClick={() => setMoreOpen(false)}
                  activeProps={{ className: "border-primary text-primary bg-primary/10" }}
                  className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl border border-border bg-card hover:bg-secondary/60 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <link.icon className="w-5 h-5" />
                  <span className="text-center leading-tight">{link.label}</span>
                </Link>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
