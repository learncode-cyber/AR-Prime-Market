import { useEffect } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
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
  Bot,
  FileText,
  ScrollText,
  PhoneCall,
  Plug,
  Clock,
  ChevronRight,
  CloudUpload,
  Cpu,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type Icon = typeof LayoutDashboard;
type Leaf = { label: string; href: string; icon?: Icon };
type Node =
  | { kind: "leaf"; label: string; href: string; icon: Icon }
  | { kind: "group"; label: string; href: string; icon: Icon; children: Leaf[] };

const overview: Node[] = [
  { kind: "leaf", label: "Dashboard", href: "/kali_master", icon: LayoutDashboard },
  { kind: "leaf", label: "Dropship", href: "/kali_master/dropshipping", icon: Factory },
  {
    kind: "group",
    label: "Products",
    href: "/kali_master/products",
    icon: Package,
    children: [
      { label: "All Products", href: "/kali_master/products" },
      { label: "Import", href: "/kali_master/products/import" },
      { label: "AliExpress", href: "/kali_master/products/import/aliexpress" },
      { label: "CJ", href: "/kali_master/products/import/cj" },
      { label: "CSV", href: "/kali_master/products/import/csv" },
    ],
  },
  { kind: "leaf", label: "Orders", href: "/kali_master/orders", icon: ShoppingCart },
];

const operations: Node[] = [
  { kind: "leaf", label: "Importer", href: "/kali_master/importer", icon: Download },
  {
    kind: "group",
    label: "CJ Settings",
    href: "/kali_master/cj-settings",
    icon: Plug,
    children: [
      { label: "All CJ Settings", href: "/kali_master/cj-settings/hub" },
      { label: "Overview", href: "/kali_master/cj-settings" },
      { label: "API", href: "/kali_master/cj-settings/api" },
      { label: "Search", href: "/kali_master/cj-settings/search" },
      { label: "Imported", href: "/kali_master/cj-settings/imported" },
      { label: "Webhook", href: "/kali_master/cj-settings/webhook" },
      { label: "Events", href: "/kali_master/cj-settings/events" },
    ],
  },
  {
    kind: "group",
    label: "API Keys",
    href: "/kali_master/api-keys",
    icon: KeyRound,
    children: [
      { label: "All API Keys", href: "/kali_master/api-keys" },
      { label: "New", href: "/kali_master/api-keys/new" },
    ],
  },
  { kind: "leaf", label: "ImgBB Key", href: "/kali_master/imgbb", icon: ImageIcon },
  { kind: "leaf", label: "Image Opt", href: "/kali_master/image-optimization", icon: Sparkles },
  {
    kind: "leaf",
    label: "R2 Migration",
    href: "/kali_master/storage-migration",
    icon: CloudUpload,
  },
  { kind: "leaf", label: "Returns", href: "/kali_master/returns", icon: RotateCcw },
  { kind: "leaf", label: "Support", href: "/kali_master/support", icon: Headphones },
  { kind: "leaf", label: "Customers", href: "/kali_master/customers", icon: Users },
];

const catalog: Node[] = [
  { kind: "leaf", label: "Categories", href: "/kali_master/categories", icon: Tag },
  { kind: "leaf", label: "Home Categories", href: "/kali_master/home-categories", icon: Layout },
  {
    kind: "group",
    label: "Coupons",
    href: "/kali_master/coupons",
    icon: Ticket,
    children: [
      { label: "All Coupons", href: "/kali_master/coupons" },
      { label: "Create", href: "/kali_master/coupons/create" },
      { label: "Analytics", href: "/kali_master/coupons/analytics" },
    ],
  },
  {
    kind: "group",
    label: "Payments",
    href: "/kali_master/payment-methods",
    icon: CreditCard,
    children: [
      { label: "All Payments", href: "/kali_master/payment-methods/hub" },
      { label: "Methods", href: "/kali_master/payment-methods" },
      { label: "Gateways", href: "/kali_master/payment-methods/gateways" },
      { label: "Transactions", href: "/kali_master/payment-methods/transactions" },
    ],
  },
  {
    kind: "group",
    label: "Shipping",
    href: "/kali_master/shipping-rates",
    icon: Truck,
    children: [
      { label: "All Shipping", href: "/kali_master/shipping-rates/hub" },
      { label: "Rates", href: "/kali_master/shipping-rates" },
      { label: "Zones", href: "/kali_master/shipping-rates/zones" },
      { label: "Carriers", href: "/kali_master/shipping-rates/carriers" },
    ],
  },
  {
    kind: "group",
    label: "Suppliers",
    href: "/kali_master/suppliers",
    icon: Factory,
    children: [
      { label: "All Suppliers", href: "/kali_master/suppliers" },
      { label: "CJ", href: "/kali_master/suppliers/cj" },
      { label: "AliExpress", href: "/kali_master/suppliers/aliexpress" },
    ],
  },
  { kind: "leaf", label: "Translations", href: "/kali_master/translations", icon: Languages },
  { kind: "leaf", label: "Content", href: "/kali_master/content", icon: Layout },
  { kind: "leaf", label: "Hero Banner", href: "/kali_master/hero", icon: ImageIcon },
];

const aiAgent: Node = {
  kind: "group",
  label: "AI Agent",
  href: "/kali_master/ai-agent",
  icon: Bot,
  children: [
    { label: "All AI Agent", href: "/kali_master/ai-agent/hub" },
    { label: "Brain", href: "/kali_master/ai-agent" },
    { label: "Web Push", href: "/kali_master/ai-agent/push" },
    { label: "Email Blast", href: "/kali_master/ai-agent/email" },
    { label: "Schedule", href: "/kali_master/ai-agent/schedule" },
    { label: "Chat", href: "/kali_master/ai-agent/chat" },
  ],
};

const growth: Node[] = [
  {
    kind: "group",
    label: "Marketing",
    href: "/kali_master/marketing-ai-hub",
    icon: Rocket,
    children: [
      { label: "All Marketing", href: "/kali_master/marketing-ai-hub/hub" },
      { label: "Overview", href: "/kali_master/marketing-ai-hub" },
      { label: "Architect", href: "/kali_master/marketing-ai-hub/architect" },
      { label: "Pixels", href: "/kali_master/marketing-ai-hub/pixels" },
      { label: "SEO", href: "/kali_master/marketing-ai-hub/seo" },
      { label: "Fake Orders", href: "/kali_master/fake-orders" },
    ],
  },
  { kind: "leaf", label: "Voice Agent", href: "/kali_master/voice-agent", icon: PhoneCall },
  { kind: "leaf", label: "Reviews", href: "/kali_master/reviews", icon: MessageSquare },
  {
    kind: "group",
    label: "Analytics",
    href: "/kali_master/analytics",
    icon: BarChart3,
    children: [
      { label: "All Analytics", href: "/kali_master/analytics/hub" },
      { label: "Overview", href: "/kali_master/analytics" },
      { label: "Meta", href: "/kali_master/meta-analytics" },
      { label: "Sales", href: "/kali_master/analytics/sales" },
      { label: "Traffic", href: "/kali_master/analytics/traffic" },
      { label: "Products", href: "/kali_master/analytics/products" },
    ],
  },
  {
    kind: "group",
    label: "SEO Audit",
    href: "/kali_master/seo-audit",
    icon: Search,
    children: [
      { label: "All SEO Audit", href: "/kali_master/seo-audit/hub" },
      { label: "Overview", href: "/kali_master/seo-audit" },
      { label: "Findings", href: "/kali_master/seo-audit/findings" },
      { label: "History", href: "/kali_master/seo-audit/history" },
      { label: "Config", href: "/kali_master/seo-audit/config" },
      { label: "Webhook", href: "/kali_master/seo-audit/webhook" },
    ],
  },
  { kind: "leaf", label: "Audit Log", href: "/kali_master/audit-log", icon: ShieldAlert },
  {
    kind: "leaf",
    label: "Security Alerts",
    href: "/kali_master/security-alerts",
    icon: ShieldAlert,
  },
  { kind: "leaf", label: "ARQ Master OS", href: "/kali_master/arq-os", icon: Cpu },
];

const blog: Node[] = [
  { kind: "leaf", label: "Blog Posts", href: "/kali_master/blog", icon: FileText },
  { kind: "leaf", label: "Blog Logs", href: "/kali_master/blog-logs", icon: ScrollText },
];

const system: Node[] = [
  { kind: "leaf", label: "Flags", href: "/kali_master/feature-flags", icon: ToggleRight },
  { kind: "leaf", label: "Settings", href: "/kali_master/settings", icon: Settings },
  { kind: "leaf", label: "Cron Jobs", href: "/kali_master/cron-jobs", icon: Clock },
  { kind: "leaf", label: "Data Export", href: "/kali_master/data-export", icon: Download },
  { kind: "leaf", label: "Status", href: "/kali_master/status", icon: Activity },
];

function isActive(currentPath: string, href: string): boolean {
  if (href === "/kali_master") return currentPath === "/kali_master";
  return currentPath === href || currentPath.startsWith(href + "/");
}

function NodeItem({ node, currentPath }: { node: Node; currentPath: string }) {
  const { setOpenMobile, isMobile } = useSidebar();
  const handleNav = () => {
    if (isMobile) setOpenMobile(false);
  };

  if (node.kind === "leaf") {
    const active = isActive(currentPath, node.href);
    return (
      <SidebarMenuItem>
        <SidebarMenuButton asChild isActive={active} tooltip={node.label}>
          <Link to={node.href as any} preload="intent" onClick={handleNav}>
            <node.icon className="h-4 w-4" />
            <span className="font-medium">{node.label}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  const parentActive = isActive(currentPath, node.href);
  return (
    <Collapsible defaultOpen={parentActive} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={node.label} isActive={parentActive}>
            <node.icon className="h-4 w-4" />
            <span className="font-medium">{node.label}</span>
            <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {node.children.map((c) => {
              const a = currentPath === c.href;
              return (
                <SidebarMenuSubItem key={c.href}>
                  <SidebarMenuSubButton asChild isActive={a}>
                    <Link to={c.href as any} preload="intent" onClick={handleNav}>
                      <span>{c.label}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

function Group({
  label,
  items,
  currentPath,
}: {
  label: string;
  items: Node[];
  currentPath: string;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((n) => (
            <NodeItem key={n.href} node={n} currentPath={currentPath} />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AdminSidebar() {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const { setOpenMobile, isMobile } = useSidebar();

  // Auto-close mobile sidebar whenever the route changes.
  useEffect(() => {
    if (isMobile) setOpenMobile(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath]);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Back to Store">
              <Link
                to="/"
                preload="intent"
                onClick={() => {
                  if (isMobile) setOpenMobile(false);
                }}
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="font-semibold">Back to Store</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <Group label="Overview" items={overview} currentPath={currentPath} />
        <Group label="Operations" items={operations} currentPath={currentPath} />
        <Group label="Catalog" items={catalog} currentPath={currentPath} />
        <Group label="AI" items={[aiAgent]} currentPath={currentPath} />
        <Group label="Growth" items={growth} currentPath={currentPath} />
        <Group label="Blog" items={blog} currentPath={currentPath} />
        <Group label="System" items={system} currentPath={currentPath} />
      </SidebarContent>
    </Sidebar>
  );
}
