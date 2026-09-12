import { createFileRoute, Link } from "@tanstack/react-router";
import { Newspaper, Download, Mail } from "lucide-react";

export const Route = createFileRoute("/press")({
  head: () => ({
    meta: [
      { title: "Press & Media — AR Prime Market" },
      {
        name: "description",
        content: "AR Prime Market press releases, media coverage, and brand assets.",
      },
    ],
  }),
  component: PressPage,
});

const pressItems = [
  {
    date: "Feb 2026",
    title: "AR Prime Market Launches Premium Ecommerce Platform in Bangladesh",
    excerpt:
      "A new player enters the BD ecommerce market with curated premium products and crypto payment options.",
  },
  {
    date: "Jan 2026",
    title: "How AR Prime Market is Redefining Online Shopping",
    excerpt:
      "With a focus on quality over quantity, AR Prime Market offers a hand-picked selection of products.",
  },
  {
    date: "Dec 2025",
    title: "AR Prime Market Partners with Global Suppliers",
    excerpt:
      "Expanding product offerings through strategic partnerships with international suppliers.",
  },
];

function PressPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-8">
        <Link to="/" className="hover:text-primary transition-colors">
          Home
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Press</span>
      </nav>

      <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-3">
        Press & Media
      </h1>
      <p className="text-muted-foreground max-w-2xl mb-10">
        Latest news, press releases, and media resources from AR Prime Market.
      </p>

      <div className="grid gap-5 mb-12">
        {pressItems.map((item) => (
          <article
            key={item.title}
            className="p-6 rounded-xl border border-border bg-card hover:shadow-md transition-shadow"
          >
            <span className="text-xs text-primary font-semibold">{item.date}</span>
            <h3 className="font-display font-semibold text-foreground mt-1">{item.title}</h3>
            <p className="text-sm text-muted-foreground mt-2">{item.excerpt}</p>
          </article>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="p-6 rounded-xl border border-border bg-card">
          <Download className="w-8 h-8 text-primary mb-3" />
          <h3 className="font-display font-semibold text-foreground">Brand Assets</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Download our logo, brand guidelines, and media kit.
          </p>
        </div>
        <div className="p-6 rounded-xl border border-border bg-card">
          <Mail className="w-8 h-8 text-primary mb-3" />
          <h3 className="font-display font-semibold text-foreground">Media Contact</h3>
          <p className="text-sm text-muted-foreground mt-1">press@arprimemarket.com</p>
        </div>
      </div>
    </div>
  );
}
