import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Upload, Loader2, Play, AlertTriangle, RefreshCw } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useR2Upload } from "@/hooks/useR2Upload";
import { HERO_VIDEO_PRESETS } from "@/lib/hero-videos";

export const Route = createFileRoute("/kali_master/hero")({
  component: AdminHero,
});

type Slide = {
  title: string;
  subtitle: string;
  description: string;
  cta_text: string;
  cta_link: string;
  image: string;
  video?: string;
  badge: string;
  accent: string;
};

const emptySlide: Slide = {
  title: "New Slide",
  subtitle: "Subtitle",
  description: "Description text",
  cta_text: "Shop Now",
  cta_link: "/products",
  image: "",
  video: "",
  badge: "✨ New",
  accent: "from-slate-900/80 via-slate-900/40",
};

const defaultSeed: Slide[] = [
  {
    title: "Traveler Vibes",
    subtitle: "Explore More",
    description: "Lifestyle এর জন্য curated পণ্য।",
    cta_text: "Shop Now",
    cta_link: "/products",
    image: "",
    video: HERO_VIDEO_PRESETS[0].url,
    badge: "🌄 Travel",
    accent: "from-slate-900/80 via-slate-900/40",
  },
  {
    title: "Tropical Escape",
    subtitle: "Summer Picks",
    description: "সমুদ্রের ধারে পরিবেশ মন কেড়ে নেয়।",
    cta_text: "Explore",
    cta_link: "/products",
    image: "",
    video: HERO_VIDEO_PRESETS[1].url,
    badge: "🏝️ Beach",
    accent: "from-rose-900/70 via-rose-900/30",
  },
  {
    title: "Night City Lights",
    subtitle: "Urban Style",
    description: "শহুরে জীবনের ছোঁয়া।",
    cta_text: "Shop Now",
    cta_link: "/products",
    image: "",
    video: HERO_VIDEO_PRESETS[2].url,
    badge: "🌃 City",
    accent: "from-slate-900/80 via-slate-900/40",
  },
];

function AdminHero() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [rowId, setRowId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["site-content-hero"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_content")
        .select("*")
        .eq("section_name", "hero_banner")
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (data === undefined) return; // still loading
    if (!data) {
      setSlides((s) => (s.length ? s : defaultSeed));
      return;
    }
    setRowId(data.id);
    const cd = data.content_data as any;
    if (cd?.slides?.length) setSlides(cd.slides);
    else setSlides((s) => (s.length ? s : defaultSeed));
  }, [data]);

  const update = (i: number, patch: Partial<Slide>) =>
    setSlides((arr) => arr.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  const remove = (i: number) => setSlides((arr) => arr.filter((_, idx) => idx !== i));
  const add = () => setSlides((arr) => [...arr, { ...emptySlide }]);

  const save = async () => {
    setSaving(true);
    const payload = { section_name: "hero_banner", content_data: { slides }, is_active: true };
    const { error } = rowId
      ? await supabase.from("site_content").update(payload).eq("id", rowId)
      : await supabase.from("site_content").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Hero saved");
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Hero Banner</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Slide প্রতি ভিডিও আপলোড করো বা ট্রাভেল প্রিসেট সিলেক্ট করো
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={add}>
            <Plus className="w-4 h-4 mr-1" /> Add Slide
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Save
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {slides.map((s, i) => (
          <SlideCard
            key={i}
            index={i}
            slide={s}
            onChange={(p) => update(i, p)}
            onRemove={() => remove(i)}
          />
        ))}
        {slides.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              কোনো slide নাই। উপরে "Add Slide" ক্লিক করো।
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function SlideCard({
  index,
  slide,
  onChange,
  onRemove,
}: {
  index: number;
  slide: Slide;
  onChange: (p: Partial<Slide>) => void;
  onRemove: () => void;
}) {
  const { uploadFile, isUploading, progress } = useR2Upload({
    prefix: "hero-videos",
    optimizeImages: false,
    useMultipartRoute: true,
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("video/")) return toast.error("Video file দরকার");
    if (file.size > 50 * 1024 * 1024) return toast.error("Max 50MB");
    try {
      const res = await uploadFile(file);
      onChange({ video: res.url });
      toast.success("Video uploaded");
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || "Upload failed");
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Slide {index + 1}</CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label={`Remove slide ${index + 1}`}
        >
          <Trash2 className="w-4 h-4 text-red-500" />
        </Button>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* LEFT: text fields */}
        <div className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={slide.title} onChange={(e) => onChange({ title: e.target.value })} />
          </div>
          <div>
            <Label>Subtitle</Label>
            <Input
              value={slide.subtitle}
              onChange={(e) => onChange({ subtitle: e.target.value })}
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              rows={2}
              value={slide.description}
              onChange={(e) => onChange({ description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>CTA Text</Label>
              <Input
                value={slide.cta_text}
                onChange={(e) => onChange({ cta_text: e.target.value })}
              />
            </div>
            <div>
              <Label>CTA Link</Label>
              <Input
                value={slide.cta_link}
                onChange={(e) => onChange({ cta_link: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Badge</Label>
            <Input value={slide.badge} onChange={(e) => onChange({ badge: e.target.value })} />
          </div>
          <div>
            <Label>Poster Image URL (fallback)</Label>
            <Input
              value={slide.image}
              onChange={(e) => onChange({ image: e.target.value })}
              placeholder="https://..."
            />
          </div>
        </div>

        {/* RIGHT: video selector + preview */}
        <div className="space-y-3">
          <div>
            <Label>Travel / Lifestyle Preset</Label>
            <Select
              value={HERO_VIDEO_PRESETS.find((p) => p.url === slide.video)?.id ?? ""}
              onValueChange={(id) => {
                const p = HERO_VIDEO_PRESETS.find((x) => x.id === id);
                if (p) onChange({ video: p.url });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Preset সিলেক্ট করো" />
              </SelectTrigger>
              <SelectContent>
                {HERO_VIDEO_PRESETS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.category} — {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">অথবা</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div>
            <Label>Custom Video Upload (max 50MB)</Label>
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => fileRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading {progress}%
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" /> Upload Video
                </>
              )}
            </Button>
          </div>

          <div>
            <Label>Video URL</Label>
            <Input
              value={slide.video || ""}
              onChange={(e) => onChange({ video: e.target.value })}
              placeholder="https://..."
            />
          </div>

          {slide.video ? (
            <VideoPreview src={slide.video} />
          ) : (
            <div className="rounded-md aspect-video bg-muted flex items-center justify-center text-xs text-muted-foreground">
              <Play className="w-4 h-4 mr-1" /> No video selected
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function VideoPreview({ src }: { src: string }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errMsg, setErrMsg] = useState<string>("");
  const [nonce, setNonce] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setStatus("loading");
    setErrMsg("");
  }, [src, nonce]);

  const retry = () => {
    setNonce((n) => n + 1);
    setTimeout(() => videoRef.current?.load(), 0);
  };

  const handleError = () => {
    const el = videoRef.current;
    const code = el?.error?.code;
    const map: Record<number, string> = {
      1: "ভিডিও লোড abort হয়েছে",
      2: "নেটওয়ার্ক error — ভিডিও fetch করা যায়নি",
      3: "ভিডিও decode করা যায়নি (corrupt বা unsupported)",
      4: "এই ভিডিও format/source সাপোর্টেড না বা URL ভুল (CORS/404)",
    };
    setErrMsg(code ? map[code] || `Unknown error (code ${code})` : "ভিডিও লোড করা যায়নি");
    setStatus("error");
  };

  return (
    <div className="space-y-2">
      <div className="rounded-md overflow-hidden border border-border/50 aspect-video bg-muted relative">
        <video
          key={nonce}
          ref={videoRef}
          src={src}
          controls
          muted
          playsInline
          preload="metadata"
          crossOrigin="anonymous"
          className="w-full h-full object-cover"
          onLoadedData={() => setStatus("ready")}
          onCanPlay={() => setStatus("ready")}
          onError={handleError}
        />
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/70 text-xs text-muted-foreground">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading…
          </div>
        )}
      </div>
      {status === "error" && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle>ভিডিও লোড হয়নি</AlertTitle>
          <AlertDescription className="space-y-2">
            <p className="text-xs">{errMsg}</p>
            <p className="text-[11px] break-all opacity-80">{src}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={retry}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Retry
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href={src} target="_blank" rel="noreferrer">
                  URL খুলে দেখো
                </a>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
