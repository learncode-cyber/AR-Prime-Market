import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/order/$ref")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: LegacyOrderRedirect,
});

function LegacyOrderRedirect() {
  const { ref } = Route.useParams();
  const { token } = Route.useSearch();
  return <Navigate to="/thank-you" search={{ order: ref, token: token ?? undefined }} replace />;
}
