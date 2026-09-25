import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const PAGE_SIZE = 20;

export type OrderRow = any;

export interface OrderStats {
  totalOrders: number;
  pendingOrders: number;
  todayRevenue: number;
  monthRevenue: number;
}

interface UseOrdersOpts {
  onNewOrder?: (order: OrderRow) => void;
}

export function useOrders(opts: UseOrdersOpts = {}) {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<OrderStats>({
    totalOrders: 0,
    pendingOrders: 0,
    todayRevenue: 0,
    monthRevenue: 0,
  });

  const onNewOrderRef = useRef(opts.onNewOrder);
  onNewOrderRef.current = opts.onNewOrder;

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, countryFilter, channelFilter]);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      let q = supabase
        .from("orders")
        .select("*, order_items(count)", { count: "exact" })
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") q = q.eq("status", statusFilter as any);
      if (countryFilter !== "all") q = q.eq("shipping_country", countryFilter);
      if (channelFilter !== "all") q = q.eq("fulfillment_channel", channelFilter);

      if (debouncedSearch) {
        const s = debouncedSearch.replace(/[%,]/g, "");
        q = q.or(
          `customer_name.ilike.%${s}%,customer_phone.ilike.%${s}%,order_number.ilike.%${s}%`,
        );
      }

      const from = (currentPage - 1) * PAGE_SIZE;
      const to = currentPage * PAGE_SIZE - 1;
      q = q.range(from, to);

      const { data, count, error } = await q;
      if (error) throw error;
      setOrders(data || []);
      setTotalCount(count || 0);
    } catch (e) {
      console.error("fetchOrders error", e);
      setOrders([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, countryFilter, channelFilter, debouncedSearch, currentPage]);

  const fetchStats = useCallback(async (): Promise<OrderStats> => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [totalRes, pendingRes, todayRes, monthRes] = await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true }),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("orders").select("total_amount").gte("created_at", startOfDay),
      supabase.from("orders").select("total_amount").gte("created_at", startOfMonth),
    ]);

    const sum = (rows: any[] | null | undefined) =>
      (rows || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);

    const next: OrderStats = {
      totalOrders: totalRes.count || 0,
      pendingOrders: pendingRes.count || 0,
      todayRevenue: sum(todayRes.data),
      monthRevenue: sum(monthRes.data),
    };
    setStats(next);
    return next;
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("orders-admin-feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, (payload) => {
        fetchOrders();
        fetchStats();
        if (onNewOrderRef.current) onNewOrderRef.current(payload.new);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOrders, fetchStats]);

  return {
    orders,
    isLoading,
    searchQuery,
    statusFilter,
    countryFilter,
    channelFilter,
    currentPage,
    totalCount,
    stats,
    PAGE_SIZE,
    setSearchQuery,
    setStatusFilter,
    setCountryFilter,
    setChannelFilter,
    setCurrentPage,
    fetchOrders,
    fetchStats,
  };
}
