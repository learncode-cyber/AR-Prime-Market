import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/kali_master/seo-audit/")({
  beforeLoad: () => {
    throw redirect({ to: "/kali_master/seo-audit/findings" });
  },
});
