"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dailyChallenge, uuidPattern, type ActionState } from "@/lib/humor";
import { captionSystemPrompt, PHOTO_BUCKET, validateCaptionInput, type PhotoInput } from "@/lib/caption-input";
import { getCaptionBrief } from "@/lib/caption-media";
import { normalizePhoto } from "@/lib/photos";
import { createAiCaption, generationIsConfigured } from "@/lib/generation";
import { GenerationError } from "@/lib/ai-providers";
import { reusePromptEnabled } from "@/features/reuse-prompt";
import { generateImage, ImageGenerationError, imageProviderPlan } from "@/lib/image-providers";
import { openCaptionDraft, sealCaptionDraft, type GenerationState } from "@/lib/caption-draft";

export async function generateCaption(_previous: ActionState, formData: FormData): Promise<GenerationState> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Please sign in again to create a caption." };
  const mode = formData.get("input_mode");
  if (mode !== "photo" && mode !== "scene") return { error: "Choose Upload a photo or Generate an image." };
  const input = validateCaptionInput(formData.get("scene"), formData.get("direction"), mode === "photo");
  if ("error" in input) return { error: input.error };
  if (!generationIsConfigured(true) || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { error: "The caption studio is unavailable. Please try again later." };
  const draftValue = formData.get("draft_token");
  const draft = typeof draftValue === "string" && draftValue ? openCaptionDraft(draftValue, process.env.SUPABASE_SERVICE_ROLE_KEY, user.id) : undefined;
  if (draftValue && (!draft || mode !== "scene" || draft.scene !== input.scene)) return { error: "That saved image has expired or the description changed. Choose Start over to generate a new image." };
  if (mode === "scene" && !draft && !imageProviderPlan(process.env).length) return { error: "Image generation is unavailable right now. Upload a photo instead to create a caption." };

  const sourceValue = formData.get("source_id");
  const sourceId = typeof sourceValue === "string" && uuidPattern.test(sourceValue) ? sourceValue : undefined;
  if (draft && draft.sourceId !== sourceId) return { error: "Start a new image instead of changing the source of a saved image." };
  if (sourceValue && (!sourceId || !reusePromptEnabled)) return { error: "Prompt reuse is unavailable. Start a new caption instead." };
  let sourcePhotoPath: string | undefined;
  let sourcePhotoOrigin: "uploaded" | "generated" | undefined;
  if (sourceId) {
    const { data: source, error } = await supabase.from("captions").select("id").eq("id", sourceId).maybeSingle();
    if (error || !source) return { error: "The source caption is unavailable. Start a new caption instead." };
    try { const brief = await getCaptionBrief(sourceId); sourcePhotoPath = brief.photoPath; sourcePhotoOrigin = brief.imageOrigin; }
    catch { return { error: "The source photo couldn’t load. Please try again." }; }
  }

  const admin = createAdminClient();
  let photo: PhotoInput | undefined;
  let uploadBytes: Buffer | undefined;
  let photoPath: string | undefined;
  let imageOrigin: "uploaded" | "generated" = "uploaded";
  let imageModel: string | undefined;
  let imagePrompt: string | undefined;
  if (draft) {
    const { data: published } = await admin.from("generations").select("caption_id").eq("id", draft.requestId).eq("user_id", user.id).maybeSingle();
    if (published) redirect(`/caption/${published.caption_id}`);
    const { data, error } = await admin.storage.from(PHOTO_BUCKET).download(draft.photoPath);
    if (error || !data || data.size > 3 * 1024 * 1024) return { error: "Your saved image couldn’t load. Choose Start over to generate a new one." };
    photo = { data: Buffer.from(await data.arrayBuffer()).toString("base64"), mimeType: "image/webp" };
    photoPath = draft.photoPath; imageOrigin = "generated"; imageModel = draft.imageModel; imagePrompt = draft.imagePrompt;
  }
  if (mode === "photo") {
    const file = formData.get("photo");
    if (file instanceof File && file.size) {
      try { const normalized = await normalizePhoto(file); photo = normalized.image; uploadBytes = normalized.bytes; }
      catch (error) { return { error: error instanceof Error ? error.message : "Choose another photo." }; }
      photoPath = `${crypto.randomUUID()}.webp`;
    } else if (sourcePhotoPath) {
      const { data, error } = await admin.storage.from(PHOTO_BUCKET).download(sourcePhotoPath);
      if (error || !data || data.size > 3 * 1024 * 1024) return { error: "The original photo couldn’t load. Upload a photo or describe an image instead." };
      photo = { data: Buffer.from(await data.arrayBuffer()).toString("base64"), mimeType: "image/webp" };
      photoPath = sourcePhotoPath;
      imageOrigin = sourcePhotoOrigin || "uploaded";
    } else return { error: "Choose a photo to upload, or select Generate an image." };
  }

  // One reservation per user submission; provider fallbacks consume no extra attempts.
  const { data: requestId, error: limitError } = await admin.rpc("reserve_generation", { p_user_id: user.id });
  if (limitError || !requestId) return { error: limitError?.message.includes("daily_limit") ? "You’ve used your 10 daily attempts. Try again after midnight New York time." : "We couldn’t start your caption. Please try again later.", ...(draft ? { draftToken: draftValue as string } : {}) };
  if (mode === "scene" && !draft) {
    try {
      const generated = await generateImage(input.scene, { env: process.env, onFailure: (provider, kind) => console.warn("Image provider failed:", provider, kind) });
      const normalized = await normalizePhoto(new File([new Uint8Array(generated.bytes)], "generated-image", { type: generated.mimeType }), 12 * 1024 * 1024);
      photo = normalized.image; uploadBytes = normalized.bytes; photoPath = `${crypto.randomUUID()}.webp`;
      imageOrigin = "generated"; imageModel = generated.model; imagePrompt = generated.prompt;
    } catch (error) {
      // No image or caption was created; release this reservation rather than charging a failed image request.
      await admin.from("generation_requests").delete().eq("id", requestId).eq("user_id", user.id);
      if (error instanceof ImageGenerationError && error.kind === "blocked") return { error: "The AI couldn’t create that image. Try a different description or upload a photo. No post was published." };
      return { error: "We couldn’t generate the image because the image providers are unavailable or at their limit. Please try again later, or upload a photo instead. No caption-only post was published." };
    }
  }
  if (uploadBytes && photoPath) {
    const { error } = await admin.storage.from(PHOTO_BUCKET).upload(photoPath, uploadBytes, { contentType: "image/webp", upsert: false });
    if (error) return { error: "Your photo couldn’t be saved. Please try again." };
  }

  let result;
  try {
    result = await createAiCaption({ ...input, photo, photoPath, sourceId, imageOrigin, imageModel, imagePrompt });
  } catch (error) {
    if (mode === "scene" && photoPath && imageModel && imagePrompt && !(error instanceof GenerationError && error.kind === "blocked")) {
      const draftToken = sealCaptionDraft({ userId: user.id, requestId: draft?.requestId || requestId, scene: input.scene, photoPath, imageModel, imagePrompt, sourceId, expiresAt: draft?.expiresAt || Date.now() + 24 * 60 * 60 * 1000 }, process.env.SUPABASE_SERVICE_ROLE_KEY);
      const { data: signed } = await admin.storage.from(PHOTO_BUCKET).createSignedUrl(photoPath, 3600);
      return { error: "Your image is saved, but the caption AIs couldn’t finish. Try Retry caption below, or edit the caption request first. We’ll reuse this image. This attempt counts toward your daily limit.", draftToken, draftPhotoUrl: signed?.signedUrl };
    }
    if (uploadBytes && photoPath) await admin.storage.from(PHOTO_BUCKET).remove([photoPath]);
    if (error instanceof GenerationError) {
      if (error.kind === "blocked") return { error: "The AI couldn’t caption this content. Try a different photo or description. This attempt counts toward your daily limit." };
      if (error.kind === "rate_limit") return { error: "The available AIs are at capacity, including the backups. Please try again in a few minutes. This attempt counts toward your daily limit." };
    }
    return { error: "The AIs couldn’t finish your caption, including the backups. Please try again shortly. This attempt counts toward your daily limit." };
  }

  const challenge = dailyChallenge();
  const { data, error } = await admin.rpc("publish_generation", {
    p_request_id: draft?.requestId || requestId, p_user_id: user.id, p_scene: result.scene, p_style: "Deadpan",
    p_caption: result.caption, p_prompt: result.prompt, p_system_prompt: captionSystemPrompt, p_model: result.model,
    p_challenge_date: mode === "scene" && input.scene === challenge.scene ? challenge.date : null,
  });
  let captionId = data;
  if (error || !captionId) {
    // The atomic publish may have committed even if its network response failed.
    const { data: saved } = await admin.from("generations").select("caption_id").eq("id", draft?.requestId || requestId).maybeSingle();
    captionId = saved?.caption_id;
    if (!captionId) return { error: "Your caption was generated, but saving it could not be confirmed. Check My collection before trying again." };
  }
  revalidatePath("/");
  revalidatePath("/collection");
  redirect(`/caption/${captionId}`);
}
