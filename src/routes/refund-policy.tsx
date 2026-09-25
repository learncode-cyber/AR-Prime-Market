import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/refund-policy")({
  head: () => ({
    meta: [
      { title: "Refund Policy — AR Prime Market" },
      { name: "description", content: "Returns and refund policy for AR Prime Market." },
    ],
  }),
  component: RefundPolicyPage,
});

function RefundPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <h1 className="font-display font-bold text-2xl sm:text-3xl text-foreground mb-6">
        Returns & Refund Policy
      </h1>
      <div className="prose prose-sm max-w-none text-muted-foreground space-y-4">
        <p>Last updated: January 2026</p>
        <h2 className="font-display font-semibold text-foreground text-lg mt-6">Return Window</h2>
        <p>
          You may return most items within 30 days of delivery for a full refund. Items must be
          unused and in original packaging.
        </p>
        <h2 className="font-display font-semibold text-foreground text-lg mt-6">How to Return</h2>
        <p>
          Contact our support team at info@arprimemarket.shop to initiate a return. We'll provide a
          return shipping label.
        </p>
        <h2 className="font-display font-semibold text-foreground text-lg mt-6">
          Refund Processing
        </h2>
        <p>
          Once we receive your return, refunds are processed within 5-7 business days to your
          original payment method.
        </p>
        <h2 className="font-display font-semibold text-foreground text-lg mt-6">
          Non-Returnable Items
        </h2>
        <p>
          Personalized items, gift cards, and hygiene products cannot be returned unless defective.
        </p>
      </div>
    </div>
  );
}
