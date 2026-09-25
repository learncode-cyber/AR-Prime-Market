import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/kali_master/products/import/")({
  beforeLoad: () => {
    throw redirect({ to: "/kali_master/products/import/cj" });
  },
});
