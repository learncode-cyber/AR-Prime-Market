import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Package,
  Heart,
  User as UserIcon,
  Clock,
  Settings,
  LogOut,
  Truck,
  CheckCircle,
  MapPin,
  Lock,
  XCircle,
  RotateCcw,
  Eye,
  EyeOff,
  LayoutDashboard,
  Mail,
  Phone,
  Calendar,
  Sparkles,
  ShoppingBag,
  ChevronRight,
  Save,
  Sun,
  Moon,
  Globe,
  DollarSign,
  CreditCard,
  Loader2,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCurrency } from "@/context/CurrencyContext";
import { useLanguage, languages } from "@/context/LanguageContext";
import { useTheme } from "@/hooks/useTheme";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ReturnRequestModal } from "@/components/ReturnRequestModal";
import { AvatarUploader } from "@/components/account/AvatarUploader";
import { AddressBookSection } from "@/components/account/AddressBookSection";
import { TwoFactorSection } from "@/components/account/TwoFactorSection";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "My Account — AR Prime Market" },
      {
        name: "description",
        content: "Manage your profile, orders, wishlist, security and preferences.",
      },
    ],
  }),
  component: AccountPage,
});

const statusConfig: Record<string, { icon: any; color: string; bg: string }> = {
  pending: { icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
  processing: { icon: Package, color: "text-blue-500", bg: "bg-blue-500/10" },
  shipped: { icon: Truck, color: "text-indigo-500", bg: "bg-indigo-500/10" },
  delivered: { icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10" },
  cancelled: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
};

type TabId =
  | "overview"
  | "orders"
  | "wishlist"
  | "addresses"
  | "profile"
  | "security"
  | "preferences";

const navItems: { id: TabId; label: string; icon: any }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "orders", label: "Orders", icon: Package },
  { id: "wishlist", label: "Wishlist", icon: Heart },
  { id: "addresses", label: "Addresses", icon: MapPin },
  { id: "profile", label: "Profile", icon: UserIcon },
  { id: "security", label: "Security", icon: Lock },
  { id: "preferences", label: "Preferences", icon: Settings },
];

function AccountPage() {
  const { user, signOut } = useAuth();
  const { formatPrice, formatInCurrency, currencies } = useCurrency();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [returnOrder, setReturnOrder] = useState<{
    id: string;
    order_number: string | null;
  } | null>(null);

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data as any;
    },
  });

  const { data: wishlist = [] } = useQuery({
    queryKey: ["my-wishlist", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("wishlists")
        .select("id, product_id, products(id, slug, title, price, currency, gallery_urls)")
        .eq("user_id", user!.id);
      return data || [];
    },
  });

  const stats = useMemo(() => {
    const totalSpent = orders.reduce((s: number, o: any) => {
      const rate = currencies.find((c) => c.code === (o.currency || "USD"))?.rate ?? 1;
      return s + Number(o.total_amount || 0) / rate;
    }, 0);
    return {
      total: orders.length,
      pending: orders.filter((o: any) => ["pending", "processing"].includes(o.status)).length,
      delivered: orders.filter((o: any) => o.status === "delivered").length,
      shipped: orders.filter((o: any) => o.status === "shipped").length,
      spent: totalSpent,
      wishlist: wishlist.length,
    };
  }, [orders, wishlist, currencies]);

  if (!user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
        <UserIcon className="w-16 h-16 text-muted-foreground/20 mb-4" />
        <h2 className="font-display font-bold text-xl text-foreground">
          Please sign in to view your account
        </h2>
        <div className="flex gap-3 mt-4">
          <Link
            to="/login"
            className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110"
          >
            Sign In
          </Link>
          <Link
            to="/signup"
            className="px-6 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-secondary"
          >
            Create account
          </Link>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  const displayName =
    profile?.full_name || user.user_metadata?.full_name || (user.email?.split("@")[0] ?? "Friend");
  const memberSince = profile?.created_at
    ? new Date(profile.created_at)
    : new Date(user.created_at);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card mb-6 sm:mb-8">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent" />
        <div className="absolute -top-24 -right-20 w-72 h-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:items-end gap-5 sm:gap-7">
          <AvatarUploader
            userId={user.id}
            avatarUrl={profile?.avatar_url || null}
            fullName={displayName}
            onChange={() => {
              refetchProfile();
              qc.invalidateQueries({ queryKey: ["my-profile"] });
            }}
          />
          <div className="flex-1 text-center sm:text-left">
            <p className="text-xs uppercase tracking-wider text-primary font-semibold mb-1">
              Welcome back
            </p>
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-foreground">
              {displayName}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 justify-center sm:justify-start">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                {user.email}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Member since{" "}
                {memberSince.toLocaleDateString(undefined, { month: "short", year: "numeric" })}
              </span>
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-background/80 backdrop-blur text-sm font-medium text-foreground hover:bg-secondary transition-colors"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[260px_1fr] gap-6">
        {/* Sidebar */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          {/* Mobile horizontal scroll */}
          <div className="lg:hidden -mx-4 px-4 overflow-x-auto scrollbar-hide">
            <div className="flex gap-2 pb-3">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex-shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    activeTab === item.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <item.icon className="w-4 h-4" /> {item.label}
                </button>
              ))}
            </div>
          </div>
          {/* Desktop sidebar */}
          <nav className="hidden lg:block rounded-2xl border border-border bg-card p-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  activeTab === item.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span className="flex-1 text-left">{item.label}</span>
                {activeTab === item.id && <ChevronRight className="w-4 h-4" />}
              </button>
            ))}
            <div className="my-2 h-px bg-border" />
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </nav>
        </aside>

        {/* Main */}
        <main className="min-w-0">
          {activeTab === "overview" && (
            <OverviewSection
              stats={stats}
              orders={orders}
              formatPrice={formatPrice}
              setTab={setActiveTab}
              loading={ordersLoading}
            />
          )}
          {activeTab === "orders" && (
            <OrdersSection
              orders={orders}
              loading={ordersLoading}
              formatPrice={formatPrice}
              onReturn={setReturnOrder}
            />
          )}
          {activeTab === "wishlist" && (
            <WishlistSection wishlist={wishlist} formatPrice={formatPrice} />
          )}
          {activeTab === "addresses" && <AddressBookSection userId={user.id} orders={orders} />}
          {activeTab === "profile" && (
            <ProfileSection
              userId={user.id}
              email={user.email || ""}
              profile={profile}
              onSaved={() => {
                refetchProfile();
                qc.invalidateQueries({ queryKey: ["my-profile"] });
              }}
            />
          )}
          {activeTab === "security" && <SecuritySection email={user.email || ""} />}
          {activeTab === "preferences" && (
            <PreferencesSection
              userId={user.id}
              marketingOptIn={!!profile?.marketing_opt_in}
              onSaved={() => refetchProfile()}
            />
          )}
        </main>
      </div>

      <ReturnRequestModal
        open={!!returnOrder}
        onOpenChange={(o) => {
          if (!o) setReturnOrder(null);
        }}
        order={returnOrder}
      />
    </div>
  );
}

/* ─────────── Section: Overview ─────────── */
function OverviewSection({ stats, orders, formatPrice, setTab, loading }: any) {
  const recent = orders.slice(0, 3);
  const statCards = [
    {
      label: "Total Orders",
      value: stats.total,
      icon: Package,
      tint: "bg-primary/10 text-primary",
    },
    {
      label: "In Progress",
      value: stats.pending + stats.shipped,
      icon: Truck,
      tint: "bg-blue-500/10 text-blue-500",
    },
    {
      label: "Delivered",
      value: stats.delivered,
      icon: CheckCircle,
      tint: "bg-green-500/10 text-green-500",
    },
    {
      label: "Wishlist",
      value: stats.wishlist,
      icon: Heart,
      tint: "bg-destructive/10 text-destructive",
    },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.tint}`}>
              <s.icon className="w-5 h-5" />
            </div>
            <p className="font-display font-bold text-2xl text-foreground mt-3">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-transparent p-5 sm:p-6">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="w-4 h-4" />
          <span className="text-xs uppercase tracking-wider font-semibold">Lifetime spend</span>
        </div>
        <p className="font-display font-extrabold text-3xl sm:text-4xl text-foreground mt-2">
          {formatPrice(stats.spent, "USD")}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Across {stats.total} order{stats.total === 1 ? "" : "s"}. Thank you for being a part of AR
          Prime Market.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-bold text-lg text-foreground">Recent orders</h2>
          <button
            onClick={() => setTab("orders")}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            View all <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-secondary/30 animate-pulse" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <div className="text-center py-12 rounded-2xl border border-border bg-card">
            <ShoppingBag className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">You haven't placed an order yet</p>
            <Link to="/products" className="mt-3 inline-block text-primary hover:underline text-sm">
              Start shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {recent.map((order: any) => (
              <OrderCard key={order.id} order={order} formatPrice={formatPrice} compact />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────── Section: Orders ─────────── */
function OrdersSection({ orders, loading, formatPrice, onReturn }: any) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 rounded-2xl bg-secondary/30 animate-pulse" />
        ))}
      </div>
    );
  }
  if (orders.length === 0) {
    return (
      <div className="text-center py-16 rounded-2xl border border-border bg-card">
        <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-muted-foreground">No orders yet</p>
        <Link
          to="/products"
          className="mt-4 inline-block px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
        >
          Browse products
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {orders.map((order: any) => (
        <OrderCard key={order.id} order={order} formatPrice={formatPrice} onReturn={onReturn} />
      ))}
    </div>
  );
}

function OrderCard({ order, formatPrice, onReturn, compact }: any) {
  const { formatInCurrency } = useCurrency();
  const cfg = statusConfig[order.status || "pending"] || statusConfig.pending;
  const StatusIcon = cfg.icon;
  return (
    <div className="p-4 sm:p-5 rounded-2xl border border-border bg-card hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display font-semibold text-sm text-foreground truncate">
            {order.order_number || `#${order.id.slice(0, 8).toUpperCase()}`}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(order.created_at).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold uppercase ${cfg.bg} ${cfg.color}`}
          >
            <StatusIcon className="w-3 h-3" />
            {order.status}
          </span>
          <span className="font-display font-bold text-sm text-foreground">
            {formatInCurrency(order.total_amount, order.currency || "USD")}
          </span>
        </div>
      </div>
      {order.order_items && order.order_items.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/50 flex gap-3 overflow-x-auto scrollbar-hide">
          {order.order_items.slice(0, compact ? 3 : 6).map((item: any) => (
            <div key={item.id} className="flex items-center gap-2 shrink-0">
              {item.image_url && (
                <img
                  src={item.image_url}
                  alt=""
                  className="w-10 h-10 rounded-lg object-cover bg-secondary"
                />
              )}
              <div>
                <p className="text-xs text-foreground line-clamp-1 max-w-[140px]">{item.title}</p>
                <p className="text-[10px] text-muted-foreground">× {item.quantity}</p>
              </div>
            </div>
          ))}
          {order.order_items.length > (compact ? 3 : 6) && (
            <span className="text-xs text-muted-foreground self-center">
              +{order.order_items.length - (compact ? 3 : 6)} more
            </span>
          )}
        </div>
      )}
      {!compact && (
        <div className="mt-3 pt-3 border-t border-border/50 flex flex-wrap justify-end gap-2">
          {order.tracking_url && (
            <a
              href={order.tracking_url}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-secondary"
            >
              <Truck className="w-3.5 h-3.5" /> Track
            </a>
          )}
          <Link
            to="/track-order"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-secondary"
          >
            <MapPin className="w-3.5 h-3.5" /> Order status
          </Link>
          {order.status === "delivered" && onReturn && (
            <button
              onClick={() => onReturn({ id: order.id, order_number: order.order_number })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-secondary"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Request return
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────── Section: Wishlist ─────────── */
function WishlistSection({ wishlist, formatPrice }: any) {
  if (wishlist.length === 0) {
    return (
      <div className="text-center py-16 rounded-2xl border border-border bg-card">
        <Heart className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-muted-foreground">Your wishlist is empty</p>
        <Link
          to="/products"
          className="mt-4 inline-block px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
        >
          Discover products
        </Link>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {wishlist.map((w: any) => {
        const p = w.products;
        if (!p) return null;
        return (
          <Link
            key={w.id}
            to="/products/$slug"
            params={{ slug: p.slug }}
            className="group rounded-2xl border border-border bg-card overflow-hidden hover:border-primary/30 transition-colors"
          >
            <div className="aspect-square bg-secondary overflow-hidden">
              {p.gallery_urls?.[0] && (
                <img
                  src={p.gallery_urls[0]}
                  alt={p.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              )}
            </div>
            <div className="p-3">
              <p className="text-sm font-medium text-foreground line-clamp-2">{p.title}</p>
              <p className="font-display font-bold text-primary mt-1">
                {formatPrice(p.price, p.currency)}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

/* ─────────── Section: Addresses ─────────── */
function AddressesSection({ orders }: any) {
  const addresses = useMemo(() => {
    const map = new Map<string, any>();
    orders.forEach((o: any) => {
      if (!o.shipping_line1) return;
      const key = `${o.shipping_line1}|${o.shipping_city}|${o.shipping_postal_code}`;
      if (!map.has(key)) {
        map.set(key, {
          name: o.customer_name,
          phone: o.customer_phone,
          line1: o.shipping_line1,
          line2: o.shipping_line2,
          city: o.shipping_city,
          state: o.shipping_state,
          postal: o.shipping_postal_code,
          country: o.shipping_country_name || o.shipping_country,
          used: 1,
        });
      } else {
        map.get(key).used++;
      }
    });
    return Array.from(map.values());
  }, [orders]);

  if (addresses.length === 0) {
    return (
      <div className="text-center py-16 rounded-2xl border border-border bg-card">
        <MapPin className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-muted-foreground">No saved addresses yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Addresses you use at checkout will appear here.
        </p>
      </div>
    );
  }
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {addresses.map((a, i) => (
        <div key={i} className="p-5 rounded-2xl border border-border bg-card">
          <div className="flex items-start justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Used {a.used}×
            </span>
          </div>
          <p className="font-display font-semibold text-sm text-foreground">{a.name}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {a.line1}
            {a.line2 && `, ${a.line2}`}
          </p>
          <p className="text-sm text-muted-foreground">
            {a.city}
            {a.state && `, ${a.state}`} {a.postal}
          </p>
          <p className="text-sm text-muted-foreground">{a.country}</p>
          {a.phone && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
              <Phone className="w-3 h-3" />
              {a.phone}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─────────── Section: Profile ─────────── */
function ProfileSection({ userId, email, profile, onSaved }: any) {
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    date_of_birth: "",
    gender: "",
    bio: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || "",
        phone: profile.phone || "",
        date_of_birth: profile.date_of_birth || "",
        gender: profile.gender || "",
        bio: profile.bio || "",
      });
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload: any = {
      full_name: form.full_name || null,
      phone: form.phone || null,
      date_of_birth: form.date_of_birth || null,
      gender: form.gender || null,
      bio: form.bio || null,
    };
    const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
    if (!error) {
      await supabase.auth.updateUser({ data: { full_name: form.full_name } });
    }
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Profile saved");
      onSaved();
    }
  };

  return (
    <form
      onSubmit={handleSave}
      className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-5"
    >
      <div>
        <h2 className="font-display font-bold text-lg text-foreground">Personal information</h2>
        <p className="text-sm text-muted-foreground">
          Update your details. Your name appears on orders and reviews.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Email" hint="Change in Security tab">
          <input
            value={email}
            disabled
            className="input-base bg-secondary/30 text-muted-foreground"
          />
        </Field>
        <Field label="Full name">
          <input
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            placeholder="Your full name"
            className="input-base"
          />
        </Field>
        <Field label="Phone">
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+1 555 000 0000"
            className="input-base"
          />
        </Field>
        <Field label="Date of birth">
          <input
            type="date"
            value={form.date_of_birth}
            onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
            className="input-base"
          />
        </Field>
        <Field label="Gender">
          <select
            value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value })}
            className="input-base"
          >
            <option value="">Prefer not to say</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="non-binary">Non-binary</option>
            <option value="other">Other</option>
          </select>
        </Field>
      </div>
      <Field label="Bio">
        <textarea
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value.slice(0, 280) })}
          rows={3}
          placeholder="Tell us a little about yourself"
          className="input-base resize-none"
        />
        <p className="text-[11px] text-muted-foreground mt-1 text-right">{form.bio.length}/280</p>
      </Field>
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:brightness-110 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-xs font-medium text-muted-foreground mb-1.5">
        <span>{label}</span>
        {hint && <span className="text-[10px]">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

/* ─────────── Section: Security ─────────── */
function SecuritySection({ email }: { email: string }) {
  const [pw, setPw] = useState({ password: "", confirm: "" });
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [strength, setStrength] = useState(0);
  const [strengthLabel, setStrengthLabel] = useState("");

  const [newEmail, setNewEmail] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);

  function computeStrength(p: string) {
    let s = 0;
    if (p.length >= 8) s++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
    if (/\d/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    setStrength(s);
    setStrengthLabel(["Too weak", "Weak", "Fair", "Good", "Strong"][s] || "");
  }

  const handleChangePw = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: string[] = [];
    if (pw.password.length < 8) errs.push("Password must be at least 8 characters");
    if (!/\d/.test(pw.password)) errs.push("Include at least one number");
    if (!/[^A-Za-z0-9]/.test(pw.password)) errs.push("Include at least one special character");
    if (pw.password !== pw.confirm) errs.push("Passwords do not match");
    if (errs.length) {
      errs.forEach((e) => toast.error(e));
      return;
    }
    setChangingPw(true);
    const { error } = await supabase.auth.updateUser({ password: pw.password });
    setChangingPw(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Password updated");
      setPw({ password: "", confirm: "" });
      computeStrength("");
    }
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || newEmail === email) {
      toast.error("Enter a different email");
      return;
    }
    setChangingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setChangingEmail(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Confirmation email sent to " + newEmail);
      setNewEmail("");
    }
  };

  const handleSignOutAll = async () => {
    setSigningOutAll(true);
    const { error } = await supabase.auth.signOut({ scope: "global" });
    setSigningOutAll(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Signed out from all devices");
      window.location.href = "/";
    }
  };

  return (
    <div className="space-y-6">
      <TwoFactorSection />
      {/* Change password */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-display font-bold text-foreground">Change password</h2>
            <p className="text-xs text-muted-foreground">Use a strong, unique password.</p>
          </div>
        </div>
        <form onSubmit={handleChangePw} className="space-y-3">
          <div className="relative">
            <input
              type={show1 ? "text" : "password"}
              placeholder="New password (min 8 chars)"
              value={pw.password}
              required
              minLength={8}
              onChange={(e) => {
                setPw({ ...pw, password: e.target.value });
                computeStrength(e.target.value);
              }}
              className="input-base pr-10"
            />
            <button
              type="button"
              onClick={() => setShow1((v) => !v)}
              aria-label={show1 ? "Hide" : "Show"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {show1 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {pw.password.length > 0 && (
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-muted-foreground">Strength: {strengthLabel}</span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-colors ${i <= strength ? (strength <= 2 ? "bg-red-500" : strength === 3 ? "bg-yellow-500" : "bg-green-500") : "bg-muted"}`}
                  />
                ))}
              </div>
              <ul className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground">
                <li className={pw.password.length >= 8 ? "text-green-600 dark:text-green-400" : ""}>
                  At least 8 characters
                </li>
                <li className={/\d/.test(pw.password) ? "text-green-600 dark:text-green-400" : ""}>
                  At least one number
                </li>
                <li
                  className={
                    /[^A-Za-z0-9]/.test(pw.password) ? "text-green-600 dark:text-green-400" : ""
                  }
                >
                  At least one special character
                </li>
              </ul>
            </div>
          )}
          <div className="relative">
            <input
              type={show2 ? "text" : "password"}
              placeholder="Confirm password"
              value={pw.confirm}
              required
              onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
              className="input-base pr-10"
            />
            <button
              type="button"
              onClick={() => setShow2((v) => !v)}
              aria-label={show2 ? "Hide" : "Show"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {show2 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button
            type="submit"
            disabled={changingPw}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:brightness-110 disabled:opacity-50"
          >
            {changingPw && <Loader2 className="w-4 h-4 animate-spin" />}
            {changingPw ? "Updating..." : "Update password"}
          </button>
        </form>
      </div>

      {/* Change email */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Mail className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-display font-bold text-foreground">Change email</h2>
            <p className="text-xs text-muted-foreground">
              Current: <span className="text-foreground">{email}</span>
            </p>
          </div>
        </div>
        <form onSubmit={handleChangeEmail} className="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            placeholder="new@email.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
            className="input-base flex-1"
          />
          <button
            type="submit"
            disabled={changingEmail}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-background text-sm font-semibold hover:bg-secondary disabled:opacity-50"
          >
            {changingEmail && <Loader2 className="w-4 h-4 animate-spin" />}
            Send confirmation
          </button>
        </form>
        <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1.5">
          <AlertCircle className="w-3 h-3" />
          You'll receive a confirmation link at both addresses.
        </p>
      </div>

      {/* Sign out everywhere */}
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-display font-bold text-foreground">Sign out everywhere</h2>
            <p className="text-xs text-muted-foreground">End sessions on all devices.</p>
          </div>
        </div>
        <button
          onClick={handleSignOutAll}
          disabled={signingOutAll}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:brightness-110 disabled:opacity-50"
        >
          {signingOutAll && <Loader2 className="w-4 h-4 animate-spin" />}
          Sign out from all devices
        </button>
      </div>
    </div>
  );
}

/* ─────────── Section: Preferences ─────────── */
function PreferencesSection({ userId, marketingOptIn, onSaved }: any) {
  const { theme, toggleTheme } = useTheme();
  const { currency, currencies, setCurrencyByCode } = useCurrency();
  const { lang, setLang } = useLanguage();
  const [optIn, setOptIn] = useState(marketingOptIn);
  const [savingOpt, setSavingOpt] = useState(false);

  useEffect(() => setOptIn(marketingOptIn), [marketingOptIn]);

  const handleToggleOpt = async (val: boolean) => {
    setOptIn(val);
    setSavingOpt(true);
    const { error } = await supabase
      .from("profiles")
      .update({ marketing_opt_in: val } as any)
      .eq("id", userId);
    setSavingOpt(false);
    if (error) {
      toast.error(error.message);
      setOptIn(!val);
    } else {
      toast.success(val ? "Subscribed to updates" : "Unsubscribed");
      onSaved();
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="font-display font-bold text-foreground mb-4">Appearance</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {theme === "dark" ? (
              <Moon className="w-4 h-4 text-primary" />
            ) : (
              <Sun className="w-4 h-4 text-primary" />
            )}
            <div>
              <p className="text-sm font-medium text-foreground">Theme</p>
              <p className="text-xs text-muted-foreground">Currently {theme}</p>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className="px-4 py-2 rounded-xl border border-border text-sm font-medium hover:bg-secondary"
          >
            Toggle
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4">
        <h2 className="font-display font-bold text-foreground">Regional</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Language">
            <div className="relative">
              <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <select
                value={lang.code}
                onChange={(e) => setLang(e.target.value as any)}
                className="input-base pl-10"
              >
                {languages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.nativeName} ({l.name})
                  </option>
                ))}
              </select>
            </div>
          </Field>
          <Field label="Currency">
            <div className="relative">
              <DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <select
                value={currency.code}
                onChange={(e) => setCurrencyByCode(e.target.value)}
                className="input-base pl-10"
              >
                {currencies.map((c: any) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.symbol}
                  </option>
                ))}
              </select>
            </div>
          </Field>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-foreground">Marketing emails</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Get notified about exclusive drops, restocks and deals.
            </p>
          </div>
          <button
            onClick={() => handleToggleOpt(!optIn)}
            disabled={savingOpt}
            role="switch"
            aria-checked={optIn}
            className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${optIn ? "bg-primary" : "bg-muted"}`}
          >
            <span
              className={`absolute top-0.5 w-6 h-6 rounded-full bg-background shadow transition-transform ${optIn ? "translate-x-5" : "translate-x-0.5"}`}
            />
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="font-display font-bold text-foreground mb-4">Quick links</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <Link
            to="/track-order"
            className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-secondary"
          >
            <MapPin className="w-4 h-4 text-primary" />
            <span className="text-sm">Track an order</span>
          </Link>
          <Link
            to="/wishlist"
            className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-secondary"
          >
            <Heart className="w-4 h-4 text-destructive" />
            <span className="text-sm">Open wishlist page</span>
          </Link>
          <Link
            to="/cart"
            className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-secondary"
          >
            <ShoppingBag className="w-4 h-4 text-primary" />
            <span className="text-sm">Go to cart</span>
          </Link>
          <Link
            to="/products"
            className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-secondary"
          >
            <CreditCard className="w-4 h-4 text-primary" />
            <span className="text-sm">Continue shopping</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
