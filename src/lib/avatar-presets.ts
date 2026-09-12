import boy1 from "@/assets/avatars/boy-1.png";
import boy2 from "@/assets/avatars/boy-2.png";
import boy3 from "@/assets/avatars/boy-3.png";
import boy4 from "@/assets/avatars/boy-4.png";
import boy5 from "@/assets/avatars/boy-5.png";
import boy6 from "@/assets/avatars/boy-6.png";
import girl1 from "@/assets/avatars/girl-1.png";
import girl2 from "@/assets/avatars/girl-2.png";
import girl3 from "@/assets/avatars/girl-3.png";
import girl4 from "@/assets/avatars/girl-4.png";
import girl5 from "@/assets/avatars/girl-5.png";
import girl6 from "@/assets/avatars/girl-6.png";

export type AvatarPreset = { id: string; url: string; group: "boys" | "girls"; label: string };

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: "boy-1", url: boy1, group: "boys", label: "Boy 1" },
  { id: "boy-2", url: boy2, group: "boys", label: "Boy 2" },
  { id: "boy-3", url: boy3, group: "boys", label: "Boy 3" },
  { id: "boy-4", url: boy4, group: "boys", label: "Boy 4" },
  { id: "boy-5", url: boy5, group: "boys", label: "Boy 5" },
  { id: "boy-6", url: boy6, group: "boys", label: "Boy 6" },
  { id: "girl-1", url: girl1, group: "girls", label: "Girl 1" },
  { id: "girl-2", url: girl2, group: "girls", label: "Girl 2" },
  { id: "girl-3", url: girl3, group: "girls", label: "Girl 3" },
  { id: "girl-4", url: girl4, group: "girls", label: "Girl 4" },
  { id: "girl-5", url: girl5, group: "girls", label: "Girl 5" },
  { id: "girl-6", url: girl6, group: "girls", label: "Girl 6" },
];
