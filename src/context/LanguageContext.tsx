import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

export type LangCode =
  | "en"
  | "bn"
  | "ar"
  | "sa"
  | "hi"
  | "es"
  | "fr"
  | "de"
  | "zh"
  | "ja"
  | "pt"
  | "ko"
  | "ru"
  | "tr"
  | "th"
  | "vi"
  | "id"
  | "ms"
  | "sw"
  | "tl"
  | "ur"
  | "fa"
  | "it"
  | "nl"
  | "pl"
  | "uk"
  | "ro"
  | "sv"
  | "da"
  | "no"
  | "fi"
  | "el"
  | "hu"
  | "cs"
  | "he";

export interface LangConfig {
  code: LangCode;
  name: string;
  nativeName: string;
  dir: "ltr" | "rtl";
}

export const languages: LangConfig[] = [
  { code: "en", name: "English", nativeName: "English", dir: "ltr" },
  { code: "bn", name: "Bangla", nativeName: "বাংলা", dir: "ltr" },
  { code: "ar", name: "Arabic (UAE)", nativeName: "العربية (الإمارات)", dir: "rtl" },
  { code: "sa", name: "Arabic (Saudi)", nativeName: "العربية (السعودية)", dir: "rtl" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", dir: "ltr" },
  { code: "ur", name: "Urdu", nativeName: "اردو", dir: "rtl" },
  { code: "es", name: "Spanish", nativeName: "Español", dir: "ltr" },
  { code: "fr", name: "French", nativeName: "Français", dir: "ltr" },
  { code: "de", name: "German", nativeName: "Deutsch", dir: "ltr" },
  { code: "it", name: "Italian", nativeName: "Italiano", dir: "ltr" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands", dir: "ltr" },
  { code: "pt", name: "Portuguese", nativeName: "Português", dir: "ltr" },
  { code: "ru", name: "Russian", nativeName: "Русский", dir: "ltr" },
  { code: "uk", name: "Ukrainian", nativeName: "Українська", dir: "ltr" },
  { code: "pl", name: "Polish", nativeName: "Polski", dir: "ltr" },
  { code: "ro", name: "Romanian", nativeName: "Română", dir: "ltr" },
  { code: "hu", name: "Hungarian", nativeName: "Magyar", dir: "ltr" },
  { code: "cs", name: "Czech", nativeName: "Čeština", dir: "ltr" },
  { code: "sv", name: "Swedish", nativeName: "Svenska", dir: "ltr" },
  { code: "da", name: "Danish", nativeName: "Dansk", dir: "ltr" },
  { code: "no", name: "Norwegian", nativeName: "Norsk", dir: "ltr" },
  { code: "fi", name: "Finnish", nativeName: "Suomi", dir: "ltr" },
  { code: "el", name: "Greek", nativeName: "Ελληνικά", dir: "ltr" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", dir: "ltr" },
  { code: "he", name: "Hebrew", nativeName: "עברית", dir: "rtl" },
  { code: "fa", name: "Persian", nativeName: "فارسی", dir: "rtl" },
  { code: "zh", name: "Chinese", nativeName: "中文", dir: "ltr" },
  { code: "ja", name: "Japanese", nativeName: "日本語", dir: "ltr" },
  { code: "ko", name: "Korean", nativeName: "한국어", dir: "ltr" },
  { code: "th", name: "Thai", nativeName: "ไทย", dir: "ltr" },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt", dir: "ltr" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", dir: "ltr" },
  { code: "ms", name: "Malay", nativeName: "Bahasa Melayu", dir: "ltr" },
  { code: "tl", name: "Filipino", nativeName: "Filipino", dir: "ltr" },
  { code: "sw", name: "Swahili", nativeName: "Kiswahili", dir: "ltr" },
];

type TranslationKey =
  | "home"
  | "products"
  | "cart"
  | "login"
  | "search"
  | "addToCart"
  | "viewCart"
  | "shopNow"
  | "viewAll"
  | "featured"
  | "bestSelling"
  | "newArrivals"
  | "trending"
  | "shopByCategory"
  | "findWhatYouNeed"
  | "megaSale"
  | "megaSaleDesc"
  | "shopTheSale"
  | "secureCheckout"
  | "freeShipping"
  | "easyReturns"
  | "support247"
  | "sslEncrypted"
  | "ordersOver999"
  | "returnPolicy30"
  | "hereToHelp"
  | "customerReviews"
  | "realReviews"
  | "orderSummary"
  | "subtotal"
  | "shipping"
  | "free"
  | "total"
  | "checkout"
  | "emptyCart"
  | "continueShopping"
  | "itemsInCart"
  | "backToProducts"
  | "searchProducts"
  | "noProductsFound"
  | "browseCollection"
  | "getExclusiveDeals"
  | "subscribeDesc"
  | "enterEmail"
  | "subscribe"
  | "subscribed"
  | "about"
  | "supportNav"
  | "policies"
  | "ourStory"
  | "careers"
  | "press"
  | "blog"
  | "helpCenter"
  | "returnsRefunds"
  | "shippingInfo"
  | "trackOrder"
  | "contactUs"
  | "privacyPolicy"
  | "termsOfService"
  | "cookiePolicy"
  | "disclaimer"
  | "weAccept"
  | "allRightsReserved"
  | "brandDesc"
  | "newSeasonCollection"
  | "upTo40Off"
  | "heroDesc1"
  | "premiumElectronics"
  | "latestGadgets"
  | "heroDesc2"
  | "homeLiving"
  | "transformSpace"
  | "heroDesc3"
  | "exploreElectronics"
  | "shopHome"
  | "dashboard"
  | "signOut"
  | "adminPanel"
  | "rating";

const translations: Record<string, Record<TranslationKey, string>> = {
  en: {
    home: "Home",
    products: "Products",
    cart: "Cart",
    login: "Login",
    search: "Search",
    addToCart: "Add to Cart",
    viewCart: "View Cart",
    shopNow: "Shop Now",
    viewAll: "View All",
    featured: "Featured Products",
    bestSelling: "Best Selling",
    newArrivals: "New Arrivals",
    trending: "Trending Now",
    shopByCategory: "Shop by Category",
    findWhatYouNeed: "Find what you need",
    megaSale: "Mega Sale — Up to 40% Off",
    megaSaleDesc: "Limited time offer on premium electronics, fashion & accessories.",
    shopTheSale: "Shop the Sale",
    secureCheckout: "Secure Checkout",
    freeShipping: "Free Shipping",
    easyReturns: "Easy Returns",
    support247: "24/7 Support",
    sslEncrypted: "SSL encrypted payments",
    ordersOver999: "On orders over $100",
    returnPolicy30: "30-day return policy",
    hereToHelp: "We're here to help",
    customerReviews: "What Our Customers Say",
    realReviews: "Real reviews from real customers",
    orderSummary: "Order Summary",
    subtotal: "Subtotal",
    shipping: "Shipping",
    free: "Free",
    total: "Total",
    checkout: "Checkout",
    emptyCart: "Your cart is empty",
    continueShopping: "Continue Shopping",
    itemsInCart: "items in your cart",
    backToProducts: "Back to Products",
    searchProducts: "Search products...",
    noProductsFound: "No products found",
    browseCollection: "Browse our curated collection",
    getExclusiveDeals: "Get Exclusive Deals",
    subscribeDesc: "Subscribe for early access & special offers.",
    enterEmail: "Enter your email",
    subscribe: "Subscribe",
    subscribed: "Subscribed ✓",
    about: "About",
    supportNav: "Support",
    policies: "Policies",
    ourStory: "Our Story",
    careers: "Careers",
    press: "Press",
    blog: "Blog",
    helpCenter: "Help Center",
    returnsRefunds: "Returns & Refunds",
    shippingInfo: "Shipping Info",
    trackOrder: "Track Order",
    contactUs: "Contact Us",
    privacyPolicy: "Privacy Policy",
    termsOfService: "Terms of Service",
    cookiePolicy: "Cookie Policy",
    disclaimer: "Disclaimer",
    weAccept: "We accept:",
    allRightsReserved: "© 2026 AR Prime Market. All rights reserved.",
    brandDesc:
      "Premium products curated for the modern lifestyle. Quality, style, and value — delivered to your doorstep.",
    newSeasonCollection: "New Season Collection",
    upTo40Off: "Up to 40% Off",
    heroDesc1: "Discover premium fashion, electronics & accessories curated just for you.",
    premiumElectronics: "Premium Electronics",
    latestGadgets: "Latest Gadgets",
    heroDesc2: "Top-rated headphones, smart watches & accessories at the best prices.",
    homeLiving: "Home & Living",
    transformSpace: "Transform Your Space",
    heroDesc3: "Beautiful home décor, candles, and organizers to elevate your lifestyle.",
    exploreElectronics: "Explore Electronics",
    shopHome: "Shop Home",
    dashboard: "Dashboard",
    signOut: "Sign Out",
    adminPanel: "Admin Panel",
    rating: "rating",
  },
  bn: {
    home: "হোম",
    products: "পণ্য",
    cart: "কার্ট",
    login: "লগইন",
    search: "সার্চ",
    addToCart: "কার্টে যোগ করুন",
    viewCart: "কার্ট দেখুন",
    shopNow: "কিনুন",
    viewAll: "সব দেখুন",
    featured: "বিশেষ পণ্য",
    bestSelling: "সর্বাধিক বিক্রিত",
    newArrivals: "নতুন আগমন",
    trending: "ট্রেন্ডিং",
    shopByCategory: "ক্যাটাগরি অনুযায়ী কিনুন",
    findWhatYouNeed: "আপনার প্রয়োজনীয় পণ্য খুঁজুন",
    megaSale: "মেগা সেল — ৪০% পর্যন্ত ছাড়",
    megaSaleDesc: "প্রিমিয়াম ইলেকট্রনিক্স, ফ্যাশন ও এক্সেসরিজে সীমিত সময়ের অফার।",
    shopTheSale: "সেল দেখুন",
    secureCheckout: "নিরাপদ চেকআউট",
    freeShipping: "ফ্রি শিপিং",
    easyReturns: "সহজ রিটার্ন",
    support247: "২৪/৭ সাপোর্ট",
    sslEncrypted: "SSL এনক্রিপ্টেড পেমেন্ট",
    ordersOver999: "$১০০+ অর্ডারে",
    returnPolicy30: "৩০ দিনের রিটার্ন পলিসি",
    hereToHelp: "আমরা সাহায্যে আছি",
    customerReviews: "গ্রাহকদের মতামত",
    realReviews: "আসল গ্রাহকদের আসল রিভিউ",
    orderSummary: "অর্ডার সারাংশ",
    subtotal: "সাবটোটাল",
    shipping: "শিপিং",
    free: "ফ্রি",
    total: "মোট",
    checkout: "চেকআউট",
    emptyCart: "আপনার কার্ট খালি",
    continueShopping: "শপিং চালিয়ে যান",
    itemsInCart: "টি পণ্য কার্টে আছে",
    backToProducts: "পণ্যে ফিরে যান",
    searchProducts: "পণ্য খুঁজুন...",
    noProductsFound: "কোনো পণ্য পাওয়া যায়নি",
    browseCollection: "আমাদের কালেকশন দেখুন",
    getExclusiveDeals: "এক্সক্লুসিভ ডিল পান",
    subscribeDesc: "বিশেষ অফার ও আপডেটের জন্য সাবস্ক্রাইব করুন।",
    enterEmail: "আপনার ইমেইল দিন",
    subscribe: "সাবস্ক্রাইব",
    subscribed: "সাবস্ক্রাইবড ✓",
    about: "সম্পর্কে",
    supportNav: "সাপোর্ট",
    policies: "পলিসি",
    ourStory: "আমাদের গল্প",
    careers: "ক্যারিয়ার",
    press: "প্রেস",
    blog: "ব্লগ",
    helpCenter: "হেল্প সেন্টার",
    returnsRefunds: "রিটার্ন ও রিফান্ড",
    shippingInfo: "শিপিং তথ্য",
    trackOrder: "অর্ডার ট্র্যাক",
    contactUs: "যোগাযোগ",
    privacyPolicy: "প্রাইভেসি পলিসি",
    termsOfService: "সেবার শর্তাবলী",
    cookiePolicy: "কুকি পলিসি",
    disclaimer: "দাবিত্যাগ",
    weAccept: "আমরা গ্রহণ করি:",
    allRightsReserved: "© ২০২৬ AR Prime Market। সর্বস্বত্ব সংরক্ষিত।",
    brandDesc:
      "আধুনিক জীবনযাত্রার জন্য প্রিমিয়াম পণ্য। গুণমান, স্টাইল ও মূল্য — আপনার দোরগোড়ায়।",
    newSeasonCollection: "নতুন সিজন কালেকশন",
    upTo40Off: "৪০% পর্যন্ত ছাড়",
    heroDesc1: "আপনার জন্য বাছাই করা প্রিমিয়াম ফ্যাশন, ইলেকট্রনিক্স ও এক্সেসরিজ।",
    premiumElectronics: "প্রিমিয়াম ইলেকট্রনিক্স",
    latestGadgets: "সর্বশেষ গ্যাজেট",
    heroDesc2: "সেরা রেটিং এর হেডফোন, স্মার্ট ওয়াচ ও এক্সেসরিজ সেরা দামে।",
    homeLiving: "হোম ও লিভিং",
    transformSpace: "আপনার স্পেস সাজান",
    heroDesc3: "আপনার জীবনযাত্রা উন্নত করার জন্য সুন্দর হোম ডেকর, ক্যান্ডেল ও অর্গানাইজার।",
    exploreElectronics: "ইলেকট্রনিক্স দেখুন",
    shopHome: "হোম শপ",
    dashboard: "ড্যাশবোর্ড",
    signOut: "সাইন আউট",
    adminPanel: "অ্যাডমিন প্যানেল",
    rating: "রেটিং",
  },
};

const LANG_KEY = "ar-pm-lang";

interface LanguageContextType {
  lang: LangConfig;
  setLang: (code: LangCode) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<LangConfig>(() => {
    if (typeof window === "undefined") return languages[0];
    const saved = localStorage.getItem(LANG_KEY);
    const found = languages.find((l) => l.code === saved);
    return found || languages[0];
  });

  const setLang = useCallback((code: LangCode) => {
    const found = languages.find((l) => l.code === code);
    if (found) {
      setLangState(found);
      if (typeof window !== "undefined") localStorage.setItem(LANG_KEY, code);
    }
  }, []);

  // Auto-detect language from server-side geo on first visit (no saved pref).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(LANG_KEY)) return; // user already has a preference
    let cancelled = false;
    import("@/integrations/supabase/client")
      .then(({ supabase }) => {
        supabase.functions
          .invoke("get-user-geo", { method: "GET" })
          .then(({ data, error }) => {
            if (cancelled || error || !data?.language) return;
            if (localStorage.getItem(LANG_KEY)) return; // race-safe
            const found = languages.find((l) => l.code === data.language);
            if (found) setLangState(found);
          })
          .catch(() => {
            /* keep default */
          });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    document.documentElement.dir = lang.dir;
    document.documentElement.lang = lang.code;
  }, [lang]);

  const t = useCallback(
    (key: TranslationKey): string => {
      return translations[lang.code]?.[key] || translations.en[key] || key;
    },
    [lang.code],
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
};
