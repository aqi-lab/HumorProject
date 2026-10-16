"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dailyChallenge, systemPrompt, uuidPattern, validateGeneration, type ActionState } from "@/lib/humor";
import { createAiCaption } from "@/lib/generation";

export async function generateCaption(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Please sign in again to create a caption." };
  const input = validateGeneration(formData.get("scene"), formData.get("style"));
  if ("error" in input) return { error: input.error };
  const remixValue = formData.get("remix_id");
  const remixId = typeof remixValue === "string" && uuidPattern.test(remixValue) ? remixValue : null;
  if (remixValue && !remixId) return { error: "That remix link is invalid. Open the original caption and try again." };
  let originalCaption: string | undefined;
  if (remixId) {
    const { data: original, error } = await supabase.from("captions").select("scene,caption").eq("id", remixId).maybeSingle();
    if (error || !original) return { error: "The original caption is unavailable. Choose another one to remix." };
    if (input.scene !== original.scene) return { error: "Keep the original scene for a remix, or start a new caption instead." };
    originalCaption = original.caption;
  }
  if ((!process.env.GEMINI_API_KEY && !process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: "The caption studio is not ready yet. Please try again later." };
  }

  const admin = createAdminClient();
  // Atomic database reservation prevents concurrent requests bypassing the daily limit.
  const { data: requestId, error: limitError } = await admin.rpc("reserve_generation", { p_user_id: user.id });
  if (limitError || !requestId) {
    return { error: limitError?.message.includes("daily_limit")
      ? "You’ve used your 10 daily attempts. Come back tomorrow for a fresh prompt!"
      : "We couldn’t start your generation. Please try again later." };
  }

  let captionId: string;
  try {
    const { caption, prompt, model } = await createAiCaption(input.scene, input.style, originalCaption);
    const challenge = dailyChallenge();
    const { data, error } = await admin.rpc("publish_generation", {
      p_request_id: requestId, p_user_id: user.id, p_scene: input.scene, p_style: input.style,
      p_caption: caption, p_prompt: prompt, p_system_prompt: systemPrompt, p_model: model,
      p_challenge_date: input.scene === challenge.scene ? challenge.date : null,
    });
    if (error || !data) throw new Error("Could not save generation");
    captionId = data;
  } catch (error) {
    console.error("Caption generation failed:", error instanceof Error ? error.message : "Unknown error");
    return { error: "Your caption couldn’t be generated and saved. Please try again. This attempt counts toward the daily limit." };
  }
  revalidatePath("/");
  revalidatePath("/collection");
  redirect(`/caption/${captionId}${remixId ? `?compare=${remixId}` : ""}`);
}
