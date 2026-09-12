import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ShoppingCart,
  Menu,
  X,
  User,
  LogOut,
  Shield,
  Heart,
  Globe,
  ChevronDown,
  Search,
} from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { CartDrawer } from "./CartDrawer";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useLanguage, languages, type LangCode } from "@/context/LanguageContext";
import { useCurrency } from "@/context/CurrencyContext";
import { AdvancedSearch } from "./AdvancedSearch";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { highlightMatch } from "@/lib/highlight";
import { SearchableMenu } from "@/components/ui/searchable-menu";
import primeMarketLogoAsset from "@/assets/ar-prime-market-logo.png.asset.json";
const primeMarketLogo = primeMarketLogoAsset.url;

export const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [desktopSearchOpen, setDesktopSearchOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [langQuery, setLangQuery] = useState("");
  const [currencyQuery, setCurrencyQuery] = useState("");
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { totalItems } = useCart();
  const { user, isAdmin, signOut } = useAuth();
  const { t, lang, setLang } = useLanguage();
  const { currency, currencies, setCurrencyByCode } = useCurrency();
  const navigate = useNavigate();
  const langRef = useRef<HTMLDivElement>(null);
  const currencyRef = useRef<HTMLDivElement>(null);
  const wishlistEnabled = useFeatureFlag("wishlist");
  const blogEnabled = useFeatureFlag("blog");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
      if (currencyRef.current && !currencyRef.current.contains(e.target as Node))
        setCurrencyOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const navLinks = [
    { label: t("home"), href: "/" as const },
    { label: t("products"), href: "/products" as const },
    ...(blogEnabled ? [{ label: "Blog", href: "/blog" as const }] : []),
    { label: t("cart"), href: "/cart" as const },
    ...(user ? [{ label: "Account", href: "/account" as const }] : []),
  ];

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-background/80 backdrop-blur-xl border-b border-border shadow-sm"
            : "bg-background/60 backdrop-blur-md"
        }`}
      >
        <nav className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 h-14 sm:h-16">
          <Link
            to="/"
            className="flex items-center gap-2 leading-none min-w-0"
            aria-label="AR Prime Market, by AR Qudrix"
          >
            <img
              src={primeMarketLogo}
              alt=""
              aria-hidden="true"
              className="hidden sm:block h-8 w-8 object-contain shrink-0"
              loading="eager"
              decoding="async"
            />
            <span className="flex flex-col min-w-0">
              <span className="font-display font-bold text-sm sm:text-base tracking-tight text-foreground whitespace-nowrap truncate leading-tight">
                AR Prime Market
              </span>
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground whitespace-nowrap leading-tight">
                by AR Qudrix
              </span>
            </span>
          </Link>

          {!desktopSearchOpen && (
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-all duration-200"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}

          {/* Desktop AdvancedSearch — expands inline when search icon clicked */}
          {desktopSearchOpen && (
            <div className="hidden md:flex flex-1 items-center gap-2 mx-3 animate-in fade-in slide-in-from-right-2 duration-200">
              <div className="flex-1">
                <AdvancedSearch />
              </div>
              <button
                onClick={() => setDesktopSearchOpen(false)}
                aria-label="Close search"
                className="p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors shrink-0"
              >
                <X className="w-[18px] h-[18px]" />
              </button>
            </div>
          )}

          <div
            className={`flex items-center gap-0.5 sm:gap-1 ${desktopSearchOpen ? "md:shrink-0" : ""}`}
          >
            {/* Desktop search trigger — only icon, expands the search bar */}
            <button
              onClick={() => setDesktopSearchOpen(true)}
              aria-label="Search"
              className={`hidden md:flex p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors ${desktopSearchOpen ? "md:hidden" : ""}`}
            >
              <Search className="w-[18px] h-[18px]" />
            </button>

            {/* Language Switcher */}
            <div
              ref={langRef}
              className={`relative hidden sm:block ${desktopSearchOpen ? "md:hidden" : ""}`}
            >
              <button
                onClick={() => {
                  setLangOpen(!langOpen);
                  setCurrencyOpen(false);
                }}
                className="flex items-center gap-1 px-2 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
              >
                <Globe className="w-4 h-4" />
                <span className="hidden lg:inline">{lang.nativeName}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {langOpen && (
                <SearchableMenu
                  query={langQuery}
                  setQuery={setLangQuery}
                  placeholder="Search language"
                  items={languages}
                  filter={(l, q) =>
                    l.nativeName.toLowerCase().includes(q) ||
                    l.name.toLowerCase().includes(q) ||
                    l.code.toLowerCase().includes(q)
                  }
                  onPick={(l) => {
                    setLang(l.code);
                    setLangOpen(false);
                    setLangQuery("");
                  }}
                  onClose={() => {
                    setLangOpen(false);
                    setLangQuery("");
                  }}
                  renderItem={(l, q) => (
                    <>
                      <span className="flex-1">{highlightMatch(l.nativeName, q)}</span>
                      <span className="text-muted-foreground">({highlightMatch(l.name, q)})</span>
                    </>
                  )}
                  isSelected={(l) => l.code === lang.code}
                  getKey={(l) => l.code}
                />
              )}
            </div>

            {/* Currency Switcher */}
            <div
              ref={currencyRef}
              className={`relative hidden sm:block ${desktopSearchOpen ? "md:hidden" : ""}`}
            >
              <button
                onClick={() => {
                  setCurrencyOpen(!currencyOpen);
                  setLangOpen(false);
                }}
                className="flex items-center gap-1 px-2 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
              >
                <span>{currency.symbol}</span>
                <span className="hidden lg:inline">{currency.code}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {currencyOpen && (
                <SearchableMenu
                  query={currencyQuery}
                  setQuery={setCurrencyQuery}
                  placeholder="Search currency"
                  items={currencies}
                  filter={(c, q) =>
                    c.code.toLowerCase().includes(q) ||
                    c.name.toLowerCase().includes(q) ||
                    c.symbol.toLowerCase().includes(q)
                  }
                  onPick={(c) => {
                    setCurrencyByCode(c.code);
                    setCurrencyOpen(false);
                    setCurrencyQuery("");
                  }}
                  onClose={() => {
                    setCurrencyOpen(false);
                    setCurrencyQuery("");
                  }}
                  renderItem={(c, q) => (
                    <>
                      <span>
                        {c.symbol} {highlightMatch(c.code, q)}
                      </span>
                      <span className="text-muted-foreground ml-1">
                        — {highlightMatch(c.name, q)}
                      </span>
                    </>
                  )}
                  isSelected={(c) => c.code === currency.code}
                  getKey={(c) => c.code}
                />
              )}
            </div>

            <ThemeToggle />

            {isAdmin && (
              <Link
                to="/kali_master"
                className="hidden md:flex p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
              >
                <Shield className="w-[18px] h-[18px]" />
              </Link>
            )}

            {user && !isAdmin && (
              <Link
                to="/account"
                className="hidden md:flex p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
              >
                <User className="w-[18px] h-[18px]" />
              </Link>
            )}

            {user && wishlistEnabled && (
              <Link
                to="/wishlist"
                className="hidden md:flex p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
              >
                <Heart className="w-[18px] h-[18px]" />
              </Link>
            )}

            {user && (
              <button
                onClick={handleSignOut}
                className="hidden md:flex p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
              >
                <LogOut className="w-[18px] h-[18px]" />
              </button>
            )}

            <button
              onClick={() => setMobileSearchOpen(true)}
              aria-label="Search"
              className="md:hidden p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors touch-manipulation"
            >
              <Search className="w-[18px] h-[18px]" />
            </button>

            <button
              onClick={() => setCartDrawerOpen(true)}
              className="relative p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors touch-manipulation"
            >
              <ShoppingCart className="w-[18px] h-[18px]" />
              {mounted && totalItems > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </button>

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors touch-manipulation"
            >
              {mobileOpen ? (
                <X className="w-[18px] h-[18px]" />
              ) : (
                <Menu className="w-[18px] h-[18px]" />
              )}
            </button>
          </div>
        </nav>

        {mobileOpen && (
          <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-xl">
            <div className="flex flex-col p-3 gap-0.5">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all touch-manipulation"
                >
                  {link.label}
                </Link>
              ))}

              {/* Mobile Language/Currency */}
              <div className="flex gap-2 px-4 py-2">
                <select
                  value={lang.code}
                  onChange={(e) => setLang(e.target.value as LangCode)}
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-xs text-foreground"
                >
                  {languages.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.nativeName}
                    </option>
                  ))}
                </select>
                <select
                  value={currency.code}
                  onChange={(e) => setCurrencyByCode(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-xs text-foreground"
                >
                  {currencies.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.symbol} {c.code}
                    </option>
                  ))}
                </select>
              </div>

              {!user && (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="px-4 py-3 rounded-lg text-sm font-semibold text-primary hover:bg-secondary transition-all touch-manipulation"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setMobileOpen(false)}
                    className="px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all touch-manipulation"
                  >
                    Create account
                  </Link>
                </>
              )}
              {user && (
                <>
                  <Link
                    to="/account"
                    onClick={() => setMobileOpen(false)}
                    className="px-4 py-3 rounded-lg text-sm font-semibold text-foreground hover:bg-secondary transition-all touch-manipulation flex items-center gap-2"
                  >
                    <User className="w-4 h-4" /> Account
                  </Link>
                  <button
                    onClick={() => {
                      handleSignOut();
                      setMobileOpen(false);
                    }}
                    className="px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all text-left touch-manipulation"
                  >
                    {t("signOut")}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </header>
      {mobileSearchOpen && (
        <div className="md:hidden fixed inset-0 z-[60] bg-background/95 backdrop-blur-xl pt-3 px-3 animate-in fade-in">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1">
              <AdvancedSearch />
            </div>
            <button
              onClick={() => setMobileSearchOpen(false)}
              aria-label="Close search"
              className="p-2.5 rounded-lg text-muted-foreground hover:bg-secondary"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
      <CartDrawer open={cartDrawerOpen} onClose={() => setCartDrawerOpen(false)} />
    </>
  );
};
