import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — AR Prime Market" },
      { name: "description", content: "Terms of service for AR Prime Market." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <h1 className="font-display font-bold text-2xl sm:text-3xl text-foreground mb-6">
        Terms of Service
      </h1>
      <div className="prose prose-sm max-w-none text-muted-foreground space-y-4">
        <p>Last updated: January 2026</p>
        <h2 className="font-display font-semibold text-foreground text-lg mt-6">
          Acceptance of Terms
        </h2>
        <p>By accessing and using AR Prime Market, you agree to these terms and conditions.</p>
        <h2 className="font-display font-semibold text-foreground text-lg mt-6">
          Orders & Payments
        </h2>
        <p>
          All orders are subject to availability and confirmation. Prices are listed in BDT and may
          be converted to your local currency.
        </p>
        <h2 className="font-display font-semibold text-foreground text-lg mt-6">
          Shipping & Delivery
        </h2>
        <p>
          We aim to process and ship orders within 1-3 business days. Delivery times vary by
          location.
        </p>
        <h2 className="font-display font-semibold text-foreground text-lg mt-6">
          Returns & Refunds
        </h2>
        <p>
          Items can be returned within 30 days of delivery in original condition. Refunds are
          processed within 5-7 business days.
        </p>
      </div>
    </div>
  );
}
