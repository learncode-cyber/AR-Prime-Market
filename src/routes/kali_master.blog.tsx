import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sparkles, Pencil, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { generateSeoBlogPost } from "@/lib/blog-ai.functions";

export const Route = createFileRoute("/kali_master/blog")({
  component: AdminBlog,
});

function AdminBlog() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const generate = useServerFn(generateSeoBlogPost);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");

  const { data: posts } = useQuery({
    queryKey: ["admin-blog-posts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const runGenerate = async (prompt?: string) => {
    setBusy(true);
    try {
      const res: any = await generate({
        data: { autoPublish: false, customPrompt: prompt },
      });
      toast.success(`Draft created: ${res?.post?.title ?? "post"}`);
      qc.invalidateQueries({ queryKey: ["admin-blog-posts"] });
      setOpen(false);
      setCustomPrompt("");
      if (res?.post?.id) navigate({ to: "/kali_master/blog/$id", params: { id: res.post.id } });
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : String(e)) || "Generation failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Blog Posts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {posts?.length || 0} posts · Daily auto-post at 4:00 AM (cron publishes; manual creates
            draft + cover image)
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => runGenerate()} disabled={busy} variant="outline" className="gap-2">
            <Sparkles className="w-4 h-4" />
            {busy ? "Generating…" : "Quick AI Draft"}
          </Button>
          <Button onClick={() => setOpen(true)} disabled={busy} className="gap-2">
            <Wand2 className="w-4 h-4" />
            Custom Prompt Draft
          </Button>
        </div>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Cover</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Title</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Author</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {posts?.map((post: any) => (
                  <tr key={post.id} className="border-b border-border/50 hover:bg-secondary/30">
                    <td className="py-2 px-4">
                      {post.featured_image_url ? (
                        <img
                          src={post.featured_image_url}
                          alt=""
                          className="w-14 h-10 object-cover rounded border border-border/50"
                        />
                      ) : (
                        <div className="w-14 h-10 rounded bg-muted/50 border border-border/50" />
                      )}
                    </td>
                    <td className="py-3 px-4 font-medium">{post.title}</td>
                    <td className="py-3 px-4 text-muted-foreground">{post.author_name || "—"}</td>
                    <td className="py-3 px-4">
                      <Badge variant={post.is_published ? "default" : "secondary"}>
                        {post.is_published ? "Published" : "Draft"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {new Date(post.created_at!).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link to="/kali_master/blog/$id" params={{ id: post.id }}>
                        <Button size="sm" variant="outline" className="gap-1">
                          <Pencil className="w-3 h-3" /> Edit / Preview
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Generate blog from your prompt</DialogTitle>
            <DialogDescription>
              Describe the article you want — topic, angle, target audience, must-include points,
              tone. The AI will write the article AND generate a matching cover image. The post is
              saved as a draft for you to review before publishing.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {[
              "Top 10 trending eco-tech gadgets for a sustainable home in 2026",
              "How to relieve lower back pain at home with smart posture correctors",
              "Which LED light therapy face mask is best for acne scars? — USA buyer's guide",
              "Premium custom minimalist jewelry trends in UAE and Middle East",
              "The ultimate smart kitchen automation setup for modern apartments",
            ].map((seed) => (
              <button
                key={seed}
                type="button"
                onClick={() => setCustomPrompt(seed)}
                disabled={busy}
                className="text-xs px-2.5 py-1 rounded-full border border-border bg-secondary hover:bg-secondary/80 text-foreground disabled:opacity-50"
              >
                {seed.length > 60 ? seed.slice(0, 57) + "…" : seed}
              </button>
            ))}
          </div>
          <Textarea
            rows={8}
            placeholder={`Example:\nWrite a high-converting buying guide for the top trending smart gadgets under $50 in 2026. Target audience: home-office buyers in USA, Canada and UK. Cover features, pros/cons, and where to buy. Friendly expert tone.`}
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            disabled={busy}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={() => runGenerate(customPrompt)}
              disabled={busy || customPrompt.trim().length < 10}
              className="gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {busy ? "Generating…" : "Generate Draft + Image"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
