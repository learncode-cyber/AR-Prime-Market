import heroFashion from "@/assets/hero-fashion.mp4.asset.json";
import heroElectronics from "@/assets/hero-electronics.mp4.asset.json";
import heroBeauty from "@/assets/hero-beauty.mp4.asset.json";
import heroTravel from "@/assets/hero-travel.mp4.asset.json";
import heroTravelBeach from "@/assets/hero-travel-beach.mp4.asset.json";
import heroTravelCity from "@/assets/hero-travel-city.mp4.asset.json";

export type HeroVideoPreset = {
  id: string;
  label: string;
  category: "Travel" | "Lifestyle";
  url: string;
};

export const HERO_VIDEO_PRESETS: HeroVideoPreset[] = [
  { id: "travel-mountain", label: "Traveler – Mountain", category: "Travel", url: heroTravel.url },
  {
    id: "travel-beach",
    label: "Traveler – Tropical Beach",
    category: "Travel",
    url: heroTravelBeach.url,
  },
  {
    id: "travel-city",
    label: "Traveler – Night City",
    category: "Travel",
    url: heroTravelCity.url,
  },
  { id: "fashion", label: "Fashion Street", category: "Lifestyle", url: heroFashion.url },
  { id: "electronics", label: "Tech Desk", category: "Lifestyle", url: heroElectronics.url },
  { id: "beauty", label: "Beauty Flat-lay", category: "Lifestyle", url: heroBeauty.url },
];

export const DEFAULT_HERO_VIDEO_POOL = [heroTravel.url, heroTravelBeach.url, heroTravelCity.url];
