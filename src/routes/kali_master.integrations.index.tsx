import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/kali_master/integrations/")({
  beforeLoad: () => {
    throw redirect({ to: "/kali_master/integrations/providers" });
  },
});
