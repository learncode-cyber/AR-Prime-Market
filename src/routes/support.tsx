import { createFileRoute, Link } from "@tanstack/react-router";
import {
  HelpCircle,
  MessageCircle,
  Mail,
  Phone,
  Package,
  RotateCcw,
  CreditCard,
  Truck,
} from "lucide-react";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Support Center — AR Prime Market" },
      { name: "description", content: "Get help with your orders, payments, shipping, and more." },
    ],
  }),
  component: SupportPage,
});

const faqs = [
  {
    q: "How do I track my order?",
    a: "Visit our Track Order page and enter your order number and email to get real-time updates.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept Visa, Mastercard, bKash, Nagad, and Cash on Delivery.",
  },
  {
    q: "How long does delivery take?",
    a: "Standard delivery within Bangladesh takes 3-5 business days. Express shipping is 1-2 days.",
  },
  {
    q: "Can I return a product?",
    a: "Yes! We offer a 30-day return policy. Visit our Returns & Refunds page for details.",
  },
];

const quickLinks = [
  { icon: Package, label: "Track Order", href: "/track-order" },
  { icon: RotateCcw, label: "Returns & Refunds", href: "/refund-policy" },
  { icon: CreditCard, label: "Payment Help", href: "/contact" },
  { icon: Truck, label: "Shipping Info", href: "/contact" },
];

function SupportPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-8">
        <Link to="/" className="hover:text-primary transition-colors">
          Home
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Support</span>
      </nav>

      <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-3">
        Support Center
      </h1>
      <p className="text-muted-foreground max-w-2xl mb-8">How can we help you today?</p>

      {/* Quick Links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        {quickLinks.map((link) => (
          <Link
            key={link.label}
            to={link.href as any}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card hover:bg-secondary/50 transition-colors text-center"
          >
            <link.icon className="w-6 h-6 text-primary" />
            <span className="text-xs font-medium text-foreground">{link.label}</span>
          </Link>
        ))}
      </div>

      {/* FAQs */}
      <h2 className="font-display font-bold text-lg text-foreground mb-4 flex items-center gap-2">
        <HelpCircle className="w-5 h-5 text-primary" />
        Frequently Asked Questions
      </h2>
      <div className="space-y-3 mb-10">
        {faqs.map((faq) => (
          <details key={faq.q} className="group rounded-xl border border-border bg-card p-4">
            <summary className="font-medium text-sm text-foreground cursor-pointer list-none flex items-center justify-between">
              {faq.q}
              <span className="text-muted-foreground group-open:rotate-45 transition-transform text-lg">
                +
              </span>
            </summary>
            <p className="text-sm text-muted-foreground mt-2">{faq.a}</p>
          </details>
        ))}
      </div>

      {/* Contact Options */}
      <h2 className="font-display font-bold text-lg text-foreground mb-4">Still Need Help?</h2>
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl border border-border bg-card text-center">
          <MessageCircle className="w-8 h-8 text-primary mx-auto mb-2" />
          <h3 className="font-semibold text-sm text-foreground">Live Chat</h3>
          <p className="text-xs text-muted-foreground mt-1">Available 24/7</p>
        </div>
        <div className="p-5 rounded-xl border border-border bg-card text-center">
          <Mail className="w-8 h-8 text-primary mx-auto mb-2" />
          <h3 className="font-semibold text-sm text-foreground">Email Us</h3>
          <p className="text-xs text-muted-foreground mt-1">info@arprimemarket.shop</p>
        </div>
        <div className="p-5 rounded-xl border border-border bg-card text-center">
          <Phone className="w-8 h-8 text-primary mx-auto mb-2" />
          <h3 className="font-semibold text-sm text-foreground">Call Us</h3>
          <p className="text-xs text-muted-foreground mt-1">+880 1700-000000</p>
        </div>
      </div>
    </div>
  );
}
