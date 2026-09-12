// Utilities for handling mixed image/video gallery URLs.

const YOUTUBE_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"];
const VIMEO_HOSTS = ["vimeo.com", "www.vimeo.com", "player.vimeo.com"];

export type MediaKind = "image" | "youtube" | "vimeo";

export function detectMediaKind(url: string): MediaKind {
  if (!url) return "image";
  try {
    const u = new URL(url);
    if (YOUTUBE_HOSTS.includes(u.hostname)) return "youtube";
    if (VIMEO_HOSTS.includes(u.hostname)) return "vimeo";
  } catch {
    // not a URL — treat as image path
  }
  return "image";
}

export function isVideoUrl(url: string): boolean {
  const k = detectMediaKind(url);
  return k === "youtube" || k === "vimeo";
}

export function toEmbedUrl(url: string): string {
  const kind = detectMediaKind(url);
  try {
    const u = new URL(url);
    if (kind === "youtube") {
      let id = "";
      if (u.hostname === "youtu.be") id = u.pathname.slice(1);
      else if (u.pathname.startsWith("/embed/")) id = u.pathname.slice(7);
      else if (u.pathname.startsWith("/shorts/")) id = u.pathname.slice(8).split("/")[0];
      else id = u.searchParams.get("v") || "";
      return id ? `https://www.youtube.com/embed/${id}` : url;
    }
    if (kind === "vimeo") {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : url;
    }
  } catch {}
  return url;
}

export function videoThumbnail(url: string): string | null {
  const kind = detectMediaKind(url);
  try {
    const u = new URL(url);
    if (kind === "youtube") {
      let id = "";
      if (u.hostname === "youtu.be") id = u.pathname.slice(1);
      else if (u.pathname.startsWith("/embed/")) id = u.pathname.slice(7);
      else if (u.pathname.startsWith("/shorts/")) id = u.pathname.slice(8).split("/")[0];
      else id = u.searchParams.get("v") || "";
      if (id) return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    }
  } catch {}
  return null;
}
