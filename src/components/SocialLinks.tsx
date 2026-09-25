import { Facebook, Instagram, Twitter, MessageCircle, Send } from "lucide-react";

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.86a8.28 8.28 0 0 0 4.76 1.5v-3.4a4.85 4.85 0 0 1-1-.27z" />
  </svg>
);

export const socialLinks = [
  {
    icon: Facebook,
    href: "https://facebook.com/share/16VHrWkGmh",
    label: "Facebook",
    color: "hover:bg-[#1877F2] hover:text-white",
  },
  {
    icon: Instagram,
    href: "https://instagram.com/arprimemarket",
    label: "Instagram",
    color:
      "hover:bg-gradient-to-tr hover:from-[#f09433] hover:via-[#e6683c] hover:to-[#bc1888] hover:text-white",
  },
  {
    icon: Twitter,
    href: "https://x.com/ARPrime05",
    label: "X (Twitter)",
    color: "hover:bg-foreground hover:text-background",
  },
  {
    icon: MessageCircle,
    href: "https://wa.me/8801910521565",
    label: "WhatsApp",
    color: "hover:bg-[#25D366] hover:text-white",
  },
  {
    icon: Send,
    href: "https://t.me/arprimemarketofficial",
    label: "Telegram",
    color: "hover:bg-[#0088cc] hover:text-white",
  },
  {
    icon: TikTokIcon,
    href: "https://tiktok.com/@ar.prime5",
    label: "TikTok",
    color: "hover:bg-foreground hover:text-background",
  },
];

interface SocialLinksProps {
  size?: "sm" | "md" | "lg";
  variant?: "default" | "branded";
  className?: string;
}

export const SocialLinksRow = ({
  size = "md",
  variant = "default",
  className = "",
}: SocialLinksProps) => {
  const iconSize = size === "sm" ? "w-3.5 h-3.5" : size === "lg" ? "w-5 h-5" : "w-4 h-4";
  const padding = size === "sm" ? "p-1.5" : size === "lg" ? "p-3" : "p-2";

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {socialLinks.map((social) => (
        <a
          key={social.label}
          href={social.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={social.label}
          className={`${padding} rounded-lg bg-secondary text-muted-foreground transition-all duration-200 touch-manipulation active:scale-95 ${
            variant === "branded" ? social.color : "hover:bg-primary hover:text-primary-foreground"
          }`}
        >
          <social.icon className={iconSize} />
        </a>
      ))}
    </div>
  );
};
