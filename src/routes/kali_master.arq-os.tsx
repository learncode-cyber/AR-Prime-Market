import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, CheckCircle2, XCircle, RefreshCw, Cpu } from "lucide-react";
import { toast } from "sonner";
import { listSubAgents, listAgentProposals, decideAgentProposal } from "@/lib/arq-os.functions";

interface Proposal {
  id: string;
  agent_slug: string;
  source: string;
  requested_by: string | null;
  task: string;
  plan_summary: string;
  payload: unknown;
  payload_kind: string;
  status: "pending" | "approved" | "applied" | "rejected";
  decision_note: string | null;
  decided_at: string | null;
  applied_at: string | null;
  created_at: string;
}

interface SubAgent {
  id: string;
  slug: string;
  display_name: string;
  role_title: string;
  payload_kind: string;
  capabilities: string[];
  is_active: boolean;
  success_count: number;
  failure_count: number;
  last_invoked_at: string | null;
  last_error: string | null;
  updated_at: string;
}

const statusColor: Record<Proposal["status"], string> = {
  pending: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
  approved: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  applied: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  rejected: "bg-red-500/15 text-red-700 border-red-500/30",
};

export const Route = createFileRoute("/kali_master/arq-os")({
  component: ArqOsPage,
});

function ArqOsPage() {
  const listAgents = useServerFn(listSubAgents);
  const listProposals = useServerFn(listAgentProposals);
  const decide = useServerFn(decideAgentProposal);
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pending" | "approved" | "applied" | "rejected" | "all">(
    "pending",
  );

  const agentsQuery = useQuery({
    queryKey: ["arq-os", "sub-agents"],
    queryFn: () => listAgents({ data: undefined }) as Promise<{ agents: SubAgent[] }>,
  });

  const proposalsQuery = useQuery({
    queryKey: ["arq-os", "proposals", tab],
    queryFn: () =>
      listProposals({ data: { status: tab, limit: 100 } }) as Promise<{
        proposals: Proposal[];
      }>,
  });

  const mutate = useMutation({
    mutationFn: (vars: { proposalId: string; decision: "approved" | "rejected"; note?: string }) =>
      decide({ data: vars }),
    onSuccess: (_d, vars) => {
      toast.success(`Proposal ${vars.decision}`);
      qc.invalidateQueries({ queryKey: ["arq-os", "proposals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const counts = useMemo(() => {
    const rows = proposalsQuery.data?.proposals ?? [];
    return rows.reduce(
      (acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [proposalsQuery.data]);

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Cpu className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-xl md:text-2xl font-semibold">ARQ Master OS</h1>
            <p className="text-sm text-muted-foreground">
              CHRO orchestrator's sub-agent proposal queue. Approving a proposal records your
              decision only — it does not automatically apply the payload (write files, run SQL, or
              launch campaigns). Applying remains a manual step.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            agentsQuery.refetch();
            proposalsQuery.refetch();
          }}
        >
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(agentsQuery.data?.agents ?? []).map((a) => (
          <Card key={a.id} className="p-3 space-y-1">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{a.display_name}</span>
              {!a.is_active && (
                <Badge variant="outline" className="text-xs">
                  inactive
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{a.role_title}</p>
            <p className="text-xs">
              ✅ {a.success_count} · ❌ {a.failure_count}
            </p>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="pending">
            Pending {counts.pending ? `(${counts.pending})` : ""}
          </TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="applied">Applied</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4 space-y-3">
          {proposalsQuery.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {proposalsQuery.isError && (
            <p className="text-sm text-red-500">Error: {(proposalsQuery.error as Error).message}</p>
          )}
          {!proposalsQuery.isLoading && (proposalsQuery.data?.proposals.length ?? 0) === 0 && (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              No proposals in this bucket. Sub-agents will queue plans here when CHRO routes a task
              to them.
            </Card>
          )}
          {(proposalsQuery.data?.proposals ?? []).map((p) => (
            <ProposalCard
              key={p.id}
              proposal={p}
              onDecide={(decision, note) => mutate.mutate({ proposalId: p.id, decision, note })}
              loading={mutate.isPending}
            />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProposalCard({
  proposal,
  onDecide,
  loading,
}: {
  proposal: Proposal;
  onDecide: (decision: "approved" | "rejected", note?: string) => void;
  loading: boolean;
}) {
  const [note, setNote] = useState("");
  const canDecide = proposal.status === "pending";

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={statusColor[proposal.status]}>
              {proposal.status}
            </Badge>
            <span className="text-sm font-medium">{proposal.agent_slug}</span>
            <Badge variant="outline" className="text-xs">
              {proposal.payload_kind}
            </Badge>
            <span className="text-xs text-muted-foreground">via {proposal.source}</span>
          </div>
          <p className="text-sm font-medium">{proposal.task}</p>
          <p className="text-xs text-muted-foreground whitespace-pre-wrap">
            {proposal.plan_summary}
          </p>
        </div>
        <div className="text-xs text-muted-foreground text-right">
          <div>{new Date(proposal.created_at).toLocaleString()}</div>
          {proposal.requested_by && <div>by {proposal.requested_by}</div>}
        </div>
      </div>

      <details>
        <summary className="text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground">
          View payload
        </summary>
        <pre className="mt-2 max-h-80 overflow-auto rounded bg-muted p-3 text-xs">
          <code>{JSON.stringify(proposal.payload, null, 2)}</code>
        </pre>
      </details>

      {proposal.decision_note && (
        <p className="text-xs text-muted-foreground">Decision note: {proposal.decision_note}</p>
      )}

      {canDecide && (
        <div className="space-y-2 pt-2 border-t">
          <Textarea
            placeholder="Optional note (visible in audit trail)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-16 text-sm"
          />
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              disabled={loading}
              onClick={() => onDecide("approved", note || undefined)}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" /> Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={loading}
              onClick={() => onDecide("rejected", note || undefined)}
            >
              <XCircle className="h-4 w-4 mr-2" /> Reject
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
