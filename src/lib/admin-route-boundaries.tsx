import { useRouter } from "@tanstack/react-router";
import { Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function AdminPending({ label = "Loading section…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function AdminErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const message = error?.message || "Unknown error";

  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="w-5 h-5" />
          Something went wrong
        </CardTitle>
        <CardDescription>
          এই সেকশনটি লোড করতে সমস্যা হয়েছে। API অথবা নেটওয়ার্ক চেক করুন এবং আবার চেষ্টা করুন।
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <pre className="text-xs bg-background/70 border border-border rounded-md p-3 overflow-auto max-h-48 whitespace-pre-wrap break-words">
          {message}
        </pre>
        <Button
          size="sm"
          onClick={() => {
            router.invalidate();
            reset();
          }}
        >
          <RefreshCw className="w-4 h-4 mr-2" /> Retry
        </Button>
      </CardContent>
    </Card>
  );
}

export function AdminNotFound() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Section not found</CardTitle>
        <CardDescription>The requested admin sub-section does not exist.</CardDescription>
      </CardHeader>
    </Card>
  );
}
