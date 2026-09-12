import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — AR Prime Market" },
      { name: "description", content: "Privacy policy for AR Prime Market." },
    ],
  }),
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <h1 className="font-display font-bold text-2xl sm:text-3xl text-foreground mb-6">
        Privacy Policy
      </h1>
      <div className="prose prose-sm max-w-none text-muted-foreground space-y-4">
        <p>Last updated: January 2026</p>
        <h2 className="font-display font-semibold text-foreground text-lg mt-6">
          Information We Collect
        </h2>
        <p>
          We collect information you provide directly, including name, email, shipping address, and
          payment details when placing orders.
        </p>
        <h2 className="font-display font-semibold text-foreground text-lg mt-6">
          How We Use Your Information
        </h2>
        <p>
          Your information is used to process orders, provide customer support, send order updates,
          and improve our services.
        </p>
        <h2 className="font-display font-semibold text-foreground text-lg mt-6">Data Security</h2>
        <p>
          We implement industry-standard security measures including SSL encryption to protect your
          personal information.
        </p>
        <h2 className="font-display font-semibold text-foreground text-lg mt-6">Contact</h2>
        <p>For privacy-related questions, contact us at info@arprimemarket.shop.</p>
      </div>
    </div>
  );
}
