import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/kali_master/payment-methods")({
  component: () => <Outlet />,
});
