import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/kali_master/marketing-ai-hub/")({
  beforeLoad: () => {
    throw redirect({ to: "/kali_master/marketing-ai-hub/pixels" });
  },
});
