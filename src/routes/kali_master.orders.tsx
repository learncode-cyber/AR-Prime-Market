import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ShoppingBag,
  Clock,
  TrendingUp,
  DollarSign,
  Search,
  PackageOpen,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrders, PAGE_SIZE } from "@/hooks/useOrders";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/kali_master/orders")({
  component: AdminOrdersPage,
});

const COUNTRY_FLAGS: Record<string, string> = {
  AE: "🇦🇪",
  SA: "🇸🇦",
  AU: "🇦🇺",
  CA: "🇨🇦",
  BD: "🇧🇩",
  US: "🇺🇸",
  GB: "🇬🇧",
};
const flagFor = (cc?: string | null) => (cc && COUNTRY_FLAGS[cc]) || "🌍";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  confirmed: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  processing: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  shipped: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  delivered: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  cancelled: "bg-red-500/15 text-red-600 dark:text-red-400",
  refunded: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
};

const CHANNEL_META: Record<string, { label: string; cls: string }> = {
  cj_dropshipping: { label: "CJ", cls: "bg-purple-500/15 text-purple-600 dark:text-purple-300" },
  steadfast: {
    label: "SteadFast",
    cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  },
  aliexpress: { label: "AliExpress", cls: "bg-orange-500/15 text-orange-600 dark:text-orange-300" },
  manual: { label: "Manual", cls: "bg-muted text-muted-foreground" },
};

function formatMoney(amount: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount || 0);
  } catch {
    return `${(amount || 0).toFixed(2)} ${currency}`;
  }
}

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d;
  }
}

function AdminOrdersPage() {
  const navigate = useNavigate();
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);

  const {
    orders,
    isLoading,
    searchQuery,
    statusFilter,
    countryFilter,
    channelFilter,
    currentPage,
    totalCount,
    stats,
    setSearchQuery,
    setStatusFilter,
    setCountryFilter,
    setChannelFilter,
    setCurrentPage,
    fetchOrders,
    fetchStats,
  } = useOrders({
    onNewOrder: (o) => {
      const flag = flagFor(o?.shipping_country);
      const country = o?.shipping_country_name || o?.shipping_country || "";
      toast(`🔔 New order from ${flag} ${country}! #${o?.order_number || ""}`.trim(), {
        duration: 6000,
      });
    },
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const rangeStart = totalCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, totalCount);

  const handleMarkShipped = async (id: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: "shipped" as any })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Order marked as shipped");
      fetchOrders();
      fetchStats();
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    const id = cancelTarget;
    setCancelTarget(null);
    const { error } = await supabase
      .from("orders")
      .update({ status: "cancelled" as any })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Order cancelled");
      fetchOrders();
      fetchStats();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Orders</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage and fulfill customer orders</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Orders"
          value={stats.totalOrders.toLocaleString()}
          icon={<ShoppingBag className="h-4 w-4" />}
        />
        <StatCard
          label="Pending"
          value={stats.pendingOrders.toLocaleString()}
          icon={<Clock className="h-4 w-4" />}
          accent="text-orange-500"
        />
        <StatCard
          label="Today's Revenue"
          value={formatMoney(stats.todayRevenue)}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatCard
          label="This Month"
          value={formatMoney(stats.monthRevenue)}
          icon={<DollarSign className="h-4 w-4" />}
        />
      </div>

      {/* Filters */}
      <Card className="border-border/50">
        <CardContent className="p-4 flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, phone, order number..."
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full lg:w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={countryFilter} onValueChange={setCountryFilter}>
            <SelectTrigger className="w-full lg:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Countries</SelectItem>
              <SelectItem value="AE">🇦🇪 UAE</SelectItem>
              <SelectItem value="SA">🇸🇦 KSA</SelectItem>
              <SelectItem value="AU">🇦🇺 Australia</SelectItem>
              <SelectItem value="CA">🇨🇦 Canada</SelectItem>
              <SelectItem value="BD">🇧🇩 Bangladesh</SelectItem>
            </SelectContent>
          </Select>
          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger className="w-full lg:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
              <SelectItem value="cj_dropshipping">CJ Dropshipping</SelectItem>
              <SelectItem value="steadfast">SteadFast</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-border/50">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading orders…
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <PackageOpen className="h-14 w-14 text-muted-foreground/50 mb-3" />
              <p className="font-medium text-foreground">No orders found</p>
              <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order: any) => {
                    const itemsCount =
                      Array.isArray(order.order_items) && order.order_items[0]
                        ? order.order_items[0].count
                        : 0;
                    const channel = order.fulfillment_channel as string | null;
                    const channelMeta = channel
                      ? CHANNEL_META[channel] || {
                          label: channel,
                          cls: "bg-muted text-muted-foreground",
                        }
                      : { label: "Pending", cls: "bg-muted text-muted-foreground" };
                    const statusCls =
                      STATUS_STYLES[order.status || "pending"] || STATUS_STYLES.pending;
                    return (
                      <TableRow key={order.id} className="hover:bg-secondary/30">
                        <TableCell>
                          <Link
                            to="/kali_master/orders/$orderId"
                            params={{ orderId: order.id }}
                            className="font-mono text-xs text-primary hover:underline"
                          >
                            {order.order_number || order.id.slice(0, 8)}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(order.created_at)}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">
                            {order.customer_name || order.guest_email || "—"}
                          </div>
                          {order.customer_phone && (
                            <div className="text-xs text-muted-foreground">
                              {order.customer_phone}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 text-sm">
                            <span className="text-base">{flagFor(order.shipping_country)}</span>
                            <span className="text-muted-foreground">
                              {order.shipping_country_name || order.shipping_country || "—"}
                            </span>
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">{itemsCount} items</TableCell>
                        <TableCell className="font-medium">
                          {formatMoney(Number(order.total_amount || 0), order.currency || "USD")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={channelMeta.cls}>
                            {channelMeta.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={`capitalize ${statusCls}`}>
                            {order.status || "pending"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                aria-label="Order actions"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  navigate({
                                    to: "/kali_master/orders/$orderId",
                                    params: { orderId: order.id },
                                  })
                                }
                              >
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleMarkShipped(order.id)}>
                                Mark as Shipped
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-500 focus:text-red-500"
                                onClick={() => setCancelTarget(order.id)}
                              >
                                Cancel Order
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {rangeStart}–{rangeEnd} of {totalCount} orders
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the order as cancelled. The customer will be notified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Cancel order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-muted-foreground text-xs">
          <span>{label}</span>
          <span className={accent || ""}>{icon}</span>
        </div>
        <p className={`mt-2 text-2xl font-bold ${accent || "text-foreground"}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
