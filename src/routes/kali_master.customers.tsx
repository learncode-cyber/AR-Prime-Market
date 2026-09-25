import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/kali_master/customers")({
  component: AdminCustomers,
});

function AdminCustomers() {
  const { data: profiles } = useQuery({
    queryKey: ["admin-customers"],
    queryFn: async () => {
      const [{ data: rows }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("id"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const roleMap = new Map<string, string>((roles ?? []).map((r) => [r.user_id, r.role]));
      return (rows ?? []).map((p) => ({ ...p, role: roleMap.get(p.id) ?? "user" }));
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Customers</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {profiles?.length || 0} registered customers
        </p>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Email</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Role</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">ID</th>
                </tr>
              </thead>
              <tbody>
                {profiles?.map((p) => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/30">
                    <td className="py-3 px-4">{p.email || "—"}</td>
                    <td className="py-3 px-4 text-muted-foreground">{p.role || "user"}</td>
                    <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                      {p.id.slice(0, 12)}…
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
