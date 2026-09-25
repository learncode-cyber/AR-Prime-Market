import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useServerFn } from "@tanstack/react-start";
import { uploadImage } from "@/lib/image-upload.functions";
import { prepareImageForUpload } from "@/lib/image-prepare";
import { toast } from "sonner";
import { Upload, X, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: { id: string; order_number: string | null } | null;
  onSubmitted?: () => void;
}

const REASONS = [
  { value: "wrong_size", label: "Wrong Size" },
  { value: "defective", label: "Defective Product" },
  { value: "damaged", label: "Damaged in Shipping" },
  { value: "not_as_described", label: "Not as Described" },
  { value: "other", label: "Other" },
];

export function ReturnRequestModal({ open, onOpenChange, order, onSubmitted }: Props) {
  const { user } = useAuth();
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<"idle" | "optimizing" | "uploading">("idle");
  const upload = useServerFn(uploadImage);

  const reset = () => {
    setCategory("");
    setDescription("");
    setFiles([]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []).slice(0, 5);
    setFiles((prev) => [...prev, ...picked].slice(0, 5));
  };

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!order || !user) return;
    if (!category) {
      toast.error("কারণ নির্বাচন করুন");
      return;
    }
    if (!description.trim() || description.trim().length < 10) {
      toast.error("কমপক্ষে ১০ অক্ষরের বিবরণ দিন");
      return;
    }

    setSubmitting(true);
    try {
      const photoUrls: string[] = [];
      for (const file of files) {
        setPhase("optimizing");
        const prepared = await prepareImageForUpload(file);
        setPhase("uploading");
        const ext = (prepared.filename.split(".").pop() || "jpg").toLowerCase();
        const path = `${user.id}/${order.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { url } = await upload({
          data: {
            base64: prepared.base64,
            filename: prepared.filename,
            contentType: prepared.contentType,
            fallbackBucket: "return-images",
            fallbackPath: path,
          },
        });
        photoUrls.push(url);
      }
      setPhase("idle");

      const reasonLabel = REASONS.find((r) => r.value === category)?.label || category;
      const { error } = await supabase.from("return_requests").insert({
        order_id: order.id,
        user_id: user.id,
        reason: reasonLabel,
        reason_category: category,
        description: description.trim(),
        photo_urls: photoUrls,
        status: "pending",
      });
      if (error) throw error;

      toast.success("রিটার্ন রিকোয়েস্ট জমা দেওয়া হয়েছে ✅");
      reset();
      onOpenChange(false);
      onSubmitted?.();
    } catch (err: unknown) {
      toast.error((err instanceof Error ? err.message : String(err)) || "জমা দিতে ব্যর্থ");
    } finally {
      setPhase("idle");
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!submitting) onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request Return — {order?.order_number || "Order"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Reason *
            </Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Description *
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What went wrong? Please share details..."
              rows={4}
              maxLength={1000}
              className="resize-none"
            />
            <p className="text-[10px] text-muted-foreground mt-1">{description.length}/1000</p>
          </div>

          <div>
            <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Photos (optional, max 5)
            </Label>
            <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-border bg-secondary/30 cursor-pointer hover:border-primary/50 transition-colors">
              <Upload className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Click to upload photos</span>
              <input
                type="file"
                accept="image/*,.heic,.heif"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                disabled={files.length >= 5}
              />
            </label>
            {files.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <div
                    key={i}
                    className="relative w-16 h-16 rounded-lg overflow-hidden bg-secondary border border-border"
                  >
                    <img
                      src={URL.createObjectURL(f)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="absolute top-0.5 right-0.5 bg-background/80 rounded-full p-0.5 hover:bg-background"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            {phase === "optimizing"
              ? "Optimizing image…"
              : phase === "uploading"
                ? "Uploading…"
                : submitting
                  ? "Submitting..."
                  : "Submit Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
