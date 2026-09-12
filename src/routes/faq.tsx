import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

const SITE_URL = "https://arprimemarket.shop";

const DEFAULT_FAQS = [
  {
    id: "1",
    question: "How long does shipping take?",
    answer:
      "Standard shipping takes 3-7 business days. Express shipping is available for 1-3 business days to USA, Canada, UK, Europe, Australia, and UAE.",
  },
  {
    id: "2",
    question: "What is your return policy?",
    answer: "We offer a 30-day return policy for all unused items in their original packaging.",
  },
  {
    id: "3",
    question: "Do you ship internationally?",
    answer: "Yes — we ship worldwide with competitive tracked-shipping rates.",
  },
  {
    id: "4",
    question: "How can I track my order?",
    answer:
      "Once your order ships, you'll receive a tracking number by email that you can use on our Track Order page.",
  },
  {
    id: "5",
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit and debit cards (Visa, Mastercard, Amex) and cryptocurrency via Binance Pay.",
  },
];

export const Route = createFileRoute("/faq")({
  loader: async () => {
    const { data } = await supabase
      .from("faq_items")
      .select("id, question, answer, category_id")
      .order("created_at");
    return { items: data && data.length > 0 ? data : DEFAULT_FAQS };
  },
  head: ({ loaderData }) => {
    const url = `${SITE_URL}/faq`;
    const items = loaderData?.items ?? DEFAULT_FAQS;
    return {
      meta: [
        { title: "FAQ — Shipping, Returns & Payments | AR Prime Market" },
        {
          name: "description",
          content:
            "Answers to common questions about worldwide shipping, returns, payment methods, and order tracking at AR Prime Market.",
        },
        { property: "og:title", content: "FAQ — Shipping, Returns & Payments | AR Prime Market" },
        {
          property: "og:description",
          content:
            "Answers to common questions about worldwide shipping, returns, payment methods, and order tracking.",
        },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: items.map((f) => ({
              "@type": "Question",
              name: f.question,
              acceptedAnswer: { "@type": "Answer", text: f.answer },
            })),
          }),
        },
      ],
    };
  },
  component: FaqPage,
});

function FaqPage() {
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["faq_items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("faq_items")
        .select("id, question, answer, category_id")
        .order("created_at");
      if (error) {
        console.error(error);
        return [];
      }
      return data || [];
    },
  });

  const faqs = items.length > 0 ? items : DEFAULT_FAQS;

  return (
    <div className="min-h-screen bg-background">
      <section className="py-12 sm:py-16 bg-card/50 border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-foreground">
            Frequently Asked Questions
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Find answers to common questions</p>
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="space-y-3">
          {faqs.map((faq) => (
            <div key={faq.id} className="rounded-2xl border border-border bg-card overflow-hidden">
              <button
                onClick={() => setOpenId(openId === faq.id ? null : faq.id)}
                className="w-full flex items-center justify-between p-4 sm:p-5 text-left"
              >
                <span className="font-display font-semibold text-sm text-foreground pr-4">
                  {faq.question}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${openId === faq.id ? "rotate-180" : ""}`}
                />
              </button>
              {openId === faq.id && (
                <div className="px-4 sm:px-5 pb-4 sm:pb-5">
                  <p className="text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
