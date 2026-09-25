import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/cookie-policy")({
  head: () => ({
    meta: [
      { title: "Cookie Policy — AR Prime Market" },
      { name: "description", content: "Cookie policy for AR Prime Market." },
    ],
  }),
  component: CookiePolicyPage,
});

function CookiePolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <h1 className="font-display font-bold text-2xl sm:text-3xl text-foreground mb-6">
        Cookie Policy
      </h1>
      <div className="prose prose-sm max-w-none text-muted-foreground space-y-4">
        <p>Last updated: January 2026</p>
        <h2 className="font-display font-semibold text-foreground text-lg mt-6">
          What Are Cookies
        </h2>
        <p>
          Cookies are small text files stored on your device when you visit our website. They help
          us provide a better experience.
        </p>
        <h2 className="font-display font-semibold text-foreground text-lg mt-6">
          How We Use Cookies
        </h2>
        <p>
          We use cookies for authentication, preferences (language, currency, theme), cart
          persistence, and analytics.
        </p>
        <h2 className="font-display font-semibold text-foreground text-lg mt-6">
          Managing Cookies
        </h2>
        <p>
          You can control cookies through your browser settings. Disabling certain cookies may
          affect site functionality.
        </p>
      </div>
    </div>
  );
}
