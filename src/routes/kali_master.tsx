import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/context/AuthContext";
import { useEffect } from "react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export const Route = createFileRoute("/kali_master")({
  component: AdminLayout,
});

function AdminLayout() {
  const { user, isAdmin, loading, adminChecked } = useAuth();
  const navigate = useNavigate();

  const checking = loading || (user != null && !adminChecked);
  const denied = !checking && (!user || !isAdmin);

  useEffect(() => {
    if (denied) navigate({ to: "/kali_master/login" });
  }, [denied, navigate]);

  // Render the shell once and swap inner content — avoids remount/double-load flicker
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AdminSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-10 flex h-12 items-center justify-between gap-2 border-b border-border bg-background/80 px-4 backdrop-blur-md">
            <SidebarTrigger className="h-9 w-9" />
            <span className="text-xs text-muted-foreground">Admin Console</span>
          </header>
          <main className="p-4 sm:p-6 lg:p-8">
            {checking ? (
              <div className="flex items-center justify-center min-h-[40vh]">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : denied ? null : (
              <Outlet />
            )}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
