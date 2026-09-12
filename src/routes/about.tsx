import { createFileRoute } from "@tanstack/react-router";
import { ShoppingBag, Heart, Globe, Users, Building2 } from "lucide-react";
import { PoweredByQudrix } from "@/components/PoweredByQudrix";
import arQudrixLogo from "@/assets/arqudrix-logo.jpg";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Us — AR Prime Market, an AR Qudrix Company" },
      {
        name: "description",
        content:
          "AR Prime Market is the international e-commerce platform owned and operated by AR Qudrix — premium products, global shipping, enterprise-grade trust.",
      },
      { property: "og:title", content: "About AR Prime Market — An AR Qudrix Company" },
      {
        property: "og:description",
        content:
          "Learn how AR Prime Market, a subsidiary of AR Qudrix, brings premium products to customers worldwide.",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: "About AR Prime Market",
          mainEntity: {
            "@type": "Organization",
            name: "AR Prime Market",
            parentOrganization: {
              "@type": "Organization",
              name: "AR Qudrix",
              url: "https://arqudrix.com",
            },
          },
        }),
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  const values = [
    {
      icon: Heart,
      title: "Quality First",
      desc: "We handpick every product to ensure it meets our high standards.",
    },
    {
      icon: Globe,
      title: "Global Reach",
      desc: "Shipping to 30+ countries with support in 35 languages.",
    },
    {
      icon: Users,
      title: "Customer Focus",
      desc: "24/7 support team dedicated to your satisfaction.",
    },
    {
      icon: ShoppingBag,
      title: "Best Value",
      desc: "Competitive pricing without compromising on quality.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <section className="py-12 sm:py-20 bg-gradient-to-br from-primary/5 via-background to-primary/3">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <PoweredByQudrix variant="company" className="mb-5" />
          <h1 className="font-display font-bold text-3xl sm:text-4xl text-foreground">Our Story</h1>
          <p className="mt-4 text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            AR Prime Market was founded with a simple mission: to bring premium products to everyone
            at fair prices. We believe that quality should never be a luxury — it should be the
            standard.
          </p>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="font-display font-bold text-xl sm:text-2xl text-foreground text-center mb-8">
            Our Values
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((v) => (
              <div
                key={v.title}
                className="rounded-2xl border border-border bg-card p-6 text-center card-hover"
              >
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <v.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-sm text-foreground">{v.title}</h3>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Parent company section */}
      <section className="py-12 sm:py-20 bg-card/40 border-y border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col items-center text-center">
            <img
              src={arQudrixLogo}
              alt="AR Qudrix"
              className="w-16 h-16 rounded-2xl object-contain bg-background border border-border p-1.5 shadow-sm mb-5"
            />
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-semibold">
              Parent Company
            </p>
            <h2 className="mt-2 font-display font-bold text-2xl sm:text-3xl text-foreground">
              An AR Qudrix Company
            </h2>
            <p className="mt-4 text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl">
              <strong className="text-foreground">AR Prime Market</strong> is owned and operated by{" "}
              <strong className="text-foreground">AR Qudrix</strong>, a technology company building
              premium digital products and global commerce platforms. As a wholly-owned subsidiary,
              AR Prime Market operates as the consumer e-commerce arm of the AR Qudrix ecosystem —
              sharing its standards for design, reliability, and enterprise-grade trust.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <PoweredByQudrix variant="company" />
              <PoweredByQudrix variant="powered" />
              <PoweredByQudrix variant="ecosystem" />
            </div>
          </div>

          <div className="mt-10 grid sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-border bg-background p-5">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-primary" />
                <h3 className="font-display font-semibold text-sm text-foreground">AR Qudrix</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Parent technology company. Builds and operates a portfolio of premium digital
                products, with a focus on international commerce, intelligent search, and
                enterprise-grade reliability.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-background p-5">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingBag className="w-4 h-4 text-primary" />
                <h3 className="font-display font-semibold text-sm text-foreground">
                  AR Prime Market
                </h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                E-commerce sub-brand of AR Qudrix. Curates and ships premium electronics, beauty,
                fashion, home and gadgets to customers in 30+ countries with secure global payments.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="font-display font-bold text-xl sm:text-2xl text-foreground mb-4">
            Why Choose Us?
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            With thousands of satisfied customers across the globe, AR Prime Market has established
            itself as a trusted destination for premium products. From electronics to fashion, home
            goods to accessories — we've got everything you need, curated with care and delivered
            with speed.
          </p>
          <div className="grid grid-cols-3 gap-6 mt-8">
            {[
              { num: "10K+", label: "Happy Customers" },
              { num: "500+", label: "Products" },
              { num: "30+", label: "Countries" },
            ].map((s) => (
              <div key={s.label}>
                <p className="font-display font-bold text-2xl sm:text-3xl text-primary">{s.num}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
