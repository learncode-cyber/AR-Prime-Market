import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runBlogGeneration } from "./blog-ai.server";

export const generateSeoBlogPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        autoPublish: z.boolean().optional(),
        customPrompt: z.string().trim().max(4000).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    // Verify admin role server-side (defence in depth)
    const { data: role } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) {
      throw new Error("Forbidden: admin role required");
    }
    return runBlogGeneration("manual", data.autoPublish ?? false, data.customPrompt);
  });
