import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { CustomerReviews } from "@/components/CustomerReviews";

vi.mock("@/context/LanguageContext", () => ({
  useLanguage: () => ({
    t: (k: string) =>
      k === "customerReviews"
        ? "What Our Customers Say"
        : k === "realReviews"
          ? "Real reviews from real shoppers"
          : k,
  }),
}));

vi.mock("framer-motion", () => {
  const make = (Tag: string) => {
    const Comp = ({ children, ...props }: any) => {
      const { initial, animate, whileInView, whileHover, whileTap, viewport, transition, ...rest } =
        props;
      return <Tag {...rest}>{children}</Tag>;
    };
    return Comp;
  };
  return {
    motion: new Proxy({}, { get: (_t, key: string) => make(key) }) as any,
  };
});

/**
 * Visual regression guard for the Customer Reviews section.
 * Asserts the *exact* structural + styling contract from the ZIP backup:
 *   - white card containers (bg-card) with rounded-2xl + border
 *   - Quote icon (lucide) positioned top-right at primary/10 opacity
 *   - gold stars: text-amber-400 fill-amber-400, w-3.5 h-3.5
 *   - font spacing: font-display headings, leading-relaxed body, mb-3/mb-4 rhythm
 *   - 4 review cards rendered (matches backup dataset)
 */
describe("CustomerReviews — visual regression (ZIP backup parity)", () => {
  const renderSection = () => render(<CustomerReviews />).container;

  it("renders the section heading with display font", () => {
    const container = renderSection();
    const heading = container.querySelector("h2");
    expect(heading).not.toBeNull();
    expect(heading?.className).toMatch(/font-display/);
    expect(heading?.className).toMatch(/font-bold/);
    expect(heading?.textContent).toBe("What Our Customers Say");
  });

  it("renders exactly 4 white review cards with rounded-2xl + border", () => {
    const container = renderSection();
    const cards = container.querySelectorAll("div.rounded-2xl.border.border-border.bg-card");
    expect(cards).toHaveLength(4);
    cards.forEach((card) => {
      expect(card.className).toMatch(/\bp-5\b/);
      expect(card.className).toMatch(/\brelative\b/);
    });
  });

  it("places a Quote icon top-right at primary/10 opacity in every card", () => {
    const container = renderSection();
    const cards = container.querySelectorAll("div.bg-card");
    cards.forEach((card) => {
      const quote = card.querySelector("svg.lucide-quote");
      expect(quote, "Quote icon missing").not.toBeNull();
      const cls = quote?.getAttribute("class") || "";
      expect(cls).toMatch(/absolute/);
      expect(cls).toMatch(/top-4/);
      expect(cls).toMatch(/right-4/);
      expect(cls).toMatch(/text-primary\/10/);
    });
  });

  it("renders gold filled stars (amber-400 / fill-amber-400, w-3.5 h-3.5)", () => {
    const container = renderSection();
    const stars = container.querySelectorAll("svg.lucide-star");
    // 3× 5-star + 1× 4-star reviews = 19 stars
    expect(stars.length).toBe(19);
    stars.forEach((s) => {
      const cls = s.getAttribute("class") || "";
      expect(cls).toMatch(/text-amber-400/);
      expect(cls).toMatch(/fill-amber-400/);
      expect(cls).toMatch(/w-3\.5/);
      expect(cls).toMatch(/h-3\.5/);
    });
  });

  it("preserves backup font + spacing rhythm on body copy", () => {
    const container = renderSection();
    const paragraphs = container.querySelectorAll("div.bg-card p.text-sm");
    expect(paragraphs.length).toBe(4);
    paragraphs.forEach((p) => {
      expect(p.className).toMatch(/text-muted-foreground/);
      expect(p.className).toMatch(/leading-relaxed/);
      expect(p.className).toMatch(/\bmb-4\b/);
      expect(p.textContent?.startsWith("\u201C")).toBe(true);
      expect(p.textContent?.endsWith("\u201D")).toBe(true);
    });
  });

  it("renders avatar bubble + reviewer name with display font", () => {
    const container = renderSection();
    const names = container.querySelectorAll("span.font-display");
    expect(names.length).toBeGreaterThanOrEqual(4);
    const avatars = container.querySelectorAll("div.w-8.h-8.rounded-full.bg-primary\\/10");
    expect(avatars.length).toBe(4);
  });

  it("structural snapshot matches the ZIP backup baseline", () => {
    const container = renderSection();
    expect(container.firstChild).toMatchSnapshot();
  });
});
