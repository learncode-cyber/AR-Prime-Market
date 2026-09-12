import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import DOMPurify from "dompurify";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  Globe,
  EyeOff,
  Sparkles,
  ExternalLink,
  ImagePlus,
  Loader2,
} from "lucide-react";
import { uploadImage } from "@/lib/image-upload.functions";
import { prepareImageForUpload } from "@/lib/image-prepare";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  getBlogPost,
  updateBlogPost,
  publishBlogPost,
  unpublishBlogPost,
} from "@/lib/blog-posts.functions";
import { generateSeoBlogPost } from "@/lib/blog-ai.functions";
import { SeoCheckerPanel } from "@/components/SeoCheckerPanel";
import { ImageUploadField } from "@/components/admin/ImageUploadField";

export const Route = createFileRoute("/kali_master/blog/$id")({
  component: BlogEditPage,
});

function BlogEditPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchPost = useServerFn(getBlogPost);
  const savePost = useServerFn(updateBlogPost);
  const publishFn = useServerFn(publishBlogPost);
  const unpublishFn = useServerFn(unpublishBlogPost);
  const regenerate = useServerFn(generateSeoBlogPost);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-blog-post", id],
    queryFn: () => fetchPost({ data: { id } }),
  });

  const [form, setForm] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    meta_title: "",
    meta_description: "",
    tags: "",
    seo_keywords: "",
    featured_image_url: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const p = data?.post as any;
    if (!p) return;
    setForm({
      title: p.title || "",
      slug: p.slug || "",
      excerpt: p.excerpt || "",
      content: p.content || "",
      meta_title: p.meta_title || "",
      meta_description: p.meta_description || "",
      tags: Array.isArray(p.tags) ? p.tags.join(", ") : "",
      seo_keywords: Array.isArray(p.seo_keywords) ? p.seo_keywords.join(", ") : "",
      featured_image_url: p.featured_image_url || "",
    });
  }, [data?.post]);

  const post = data?.post;
  const isPublished = !!post?.is_published;

  const handleSave = async () => {
    setBusy(true);
    try {
      await savePost({
        data: {
          id,
          title: form.title,
          slug: form.slug,
          excerpt: form.excerpt,
          content: form.content,
          meta_title: form.meta_title,
          meta_description: form.meta_description,
          tags: form.tags
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          seo_keywords: form.seo_keywords
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          featured_image_url: form.featured_image_url.trim() || null,
        },
      });
      toast.success("Saved");
      refetch();
      qc.invalidateQueries({ queryKey: ["admin-blog-posts"] });
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const handlePublishToggle = async () => {
    setBusy(true);
    try {
      if (isPublished) {
        await unpublishFn({ data: { id } });
        toast.success("Unpublished");
      } else {
        await savePost({
          data: {
            id,
            title: form.title,
            slug: form.slug,
            excerpt: form.excerpt,
            content: form.content,
            meta_title: form.meta_title,
            meta_description: form.meta_description,
            tags: form.tags
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            seo_keywords: form.seo_keywords
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            featured_image_url: form.featured_image_url.trim() || null,
          },
        });
        await publishFn({ data: { id } });
        toast.success("Published!");
      }
      refetch();
      qc.invalidateQueries({ queryKey: ["admin-blog-posts"] });
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const handleRegenerate = async () => {
    if (
      !confirm(
        "Generate a brand-new AI draft? This will NOT overwrite the current post — it will create a new draft.",
      )
    )
      return;
    setBusy(true);
    try {
      const res: any = await regenerate({ data: { autoPublish: false } });
      toast.success("New draft generated");
      qc.invalidateQueries({ queryKey: ["admin-blog-posts"] });
      if (res?.post?.id) navigate({ to: "/kali_master/blog/$id", params: { id: res.post.id } });
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">Loading…</div>;
  }
  if (!post) {
    return <div className="text-center py-12 text-muted-foreground">Post not found</div>;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link
            to="/kali_master/blog"
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <Badge variant={isPublished ? "default" : "secondary"}>
            {isPublished ? "Published" : "Draft"}
          </Badge>
          {isPublished && (
            <Link
              to="/blog/$slug"
              params={{ slug: post.slug }}
              target="_blank"
              className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
            >
              <ExternalLink className="w-3 h-3" /> Open public page
            </Link>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={busy}>
            <Sparkles className="w-4 h-4 mr-1" /> New AI Draft
          </Button>
          <Button variant="outline" size="sm" onClick={handleSave} disabled={busy}>
            <Save className="w-4 h-4 mr-1" /> Save draft
          </Button>
          <Button
            size="sm"
            onClick={handlePublishToggle}
            disabled={busy}
            variant={isPublished ? "destructive" : "default"}
          >
            {isPublished ? (
              <>
                <EyeOff className="w-4 h-4 mr-1" /> Unpublish
              </>
            ) : (
              <>
                <Globe className="w-4 h-4 mr-1" /> Publish
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Edit panel */}
        <Card className="p-4 space-y-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
            Edit
          </div>
          <Field label="Title">
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>
          <Field label="Slug">
            <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          </Field>
          <Field label="Excerpt">
            <Textarea
              rows={2}
              value={form.excerpt}
              onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
            />
          </Field>
          <Field label="Featured image (AI-generated, editable)">
            <ImageUploadField
              value={form.featured_image_url}
              onChange={(url) => setForm({ ...form, featured_image_url: url })}
              bucket="blog-images"
              pathPrefix={`manual/${form.slug || "post"}`}
              placeholder="https://… or click Upload"
              preview={false}
            />
            {form.featured_image_url && (
              <img
                src={form.featured_image_url}
                alt="cover preview"
                className="mt-2 w-full max-h-40 object-cover rounded border border-border/50"
              />
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Meta title">
              <Input
                value={form.meta_title}
                onChange={(e) => setForm({ ...form, meta_title: e.target.value })}
              />
            </Field>
            <Field label="Meta description">
              <Input
                value={form.meta_description}
                onChange={(e) => setForm({ ...form, meta_description: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tags (comma-separated)">
              <Input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
              />
            </Field>
            <Field label="SEO keywords (comma-separated)">
              <Input
                value={form.seo_keywords}
                onChange={(e) => setForm({ ...form, seo_keywords: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Content (HTML)">
            <InlineContentEditor
              value={form.content}
              onChange={(content) => setForm({ ...form, content })}
              slug={form.slug || "post"}
            />
          </Field>
        </Card>

        {/* Preview + SEO panel */}
        <div className="space-y-4">
          <SeoCheckerPanel
            title={form.title}
            metaTitle={form.meta_title}
            metaDescription={form.meta_description}
            slug={form.slug}
            content={form.content}
            featuredImage={form.featured_image_url}
            seoKeywords={form.seo_keywords
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)}
            publicUrl={isPublished ? `https://arprimemarket.shop/blog/${form.slug}` : undefined}
          />
          <Card
            className="p-6 space-y-4 overflow-auto"
            style={{ maxHeight: "calc(100vh - 14rem)" }}
          >
            <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
              Live preview
            </div>
            <article className="prose prose-sm max-w-none dark:prose-invert">
              {form.featured_image_url && (
                <img
                  src={form.featured_image_url}
                  alt={form.title}
                  className="w-full max-h-72 object-cover rounded-lg !mt-0 !mb-4"
                />
              )}
              <h1 className="text-3xl font-bold !mb-2">{form.title || "Untitled"}</h1>
              {form.excerpt && <p className="text-muted-foreground !mt-0">{form.excerpt}</p>}
              <div className="text-xs text-muted-foreground flex gap-3 !mt-2 !mb-6">
                <span>By {post.author_name || "AR Prime Market"}</span>
                <span>·</span>
                <span>/blog/{form.slug || "—"}</span>
              </div>
              <div
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(form.content || "<p><em>No content yet</em></p>"),
                }}
              />
            </article>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function InlineContentEditor({
  value,
  onChange,
  slug,
}: {
  value: string;
  onChange: (v: string) => void;
  slug: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useServerFn(uploadImage);
  const [busy, setBusy] = useState(false);

  const insertAtCursor = (snippet: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      onChange(value + snippet);
      return;
    }
    const start = ta.selectionStart ?? value.length;
    const end = ta.selectionEnd ?? value.length;
    const next = value.slice(0, start) + snippet + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + snippet.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const onFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Image too large (max 15 MB)");
      return;
    }
    setBusy(true);
    try {
      const prepared = await prepareImageForUpload(file);
      const ext = (prepared.filename.split(".").pop() || "jpg").toLowerCase();
      const path = `inline/${slug}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const res = await upload({
        data: {
          base64: prepared.base64,
          filename: prepared.filename,
          contentType: prepared.contentType,
          fallbackBucket: "blog-images",
          fallbackPath: path,
        },
      });
      const alt = file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ");
      const snippet = `\n<img src="${res.url}" alt="${alt}" loading="lazy" />\n`;
      insertAtCursor(snippet);
      toast.success(res.provider === "r2" ? "Image inserted (R2)" : "Image inserted");
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          {busy ? (
            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
          ) : (
            <ImagePlus className="w-3.5 h-3.5 mr-1" />
          )}
          {busy ? "Uploading to R2…" : "Insert image (R2)"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Inserts an &lt;img&gt; tag at the cursor. Stored on Cloudflare R2.
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.heic,.heif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </div>
      <Textarea
        ref={textareaRef}
        rows={20}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono text-xs"
      />
    </div>
  );
}
