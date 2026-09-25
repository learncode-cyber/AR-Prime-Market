import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/kali_master/cj-settings/")({
  beforeLoad: () => {
    throw redirect({ to: "/kali_master/cj-settings/api" });
  },
});
