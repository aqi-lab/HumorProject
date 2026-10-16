"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PHOTO_BUCKET, readPublicBrief } from "@/lib/caption-input";
import { generateImage, ImageGenerationError } from "@/lib/image-providers";
import { normalizePhoto } from "@/lib/photos";
import { uuidPattern, type ActionState } from "@/lib/humor";

export async function generateMissingImage(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const id = formData.get("caption_id");
  if (typeof id !== "string" || !uuidPattern.test(id)) return { error: "Open a valid caption to create its image." };
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { error: "Sign in to add an image to your caption." };
  const { data: generation, error } = await client.from("generations").select("prompt").eq("caption_id", id).eq("user_id", user.id).maybeSingle();
  if (error || !generation) return { error: "You can only add an image to a caption you created." };
  if (readPublicBrief(generation.prompt).photoPath) return { success: "This caption already has an image. Refresh to see it." };
  const { data: caption } = await client.from("captions").select("scene").eq("id", id).maybeSingle();
  if (!caption) return { error: "The caption could not be found." };
  const scene = readPublicBrief(generation.prompt).scene || caption.scene;
  const admin = createAdminClient();
  const { data: requestId, error: limitError } = await admin.rpc("reserve_generation", { p_user_id: user.id });
  if (limitError || !requestId) return { error: limitError?.message.includes("daily_limit") ? "You’ve used today’s attempts. Try again after midnight New York time." : "Image generation couldn’t start. Try again shortly." };
  let path: string | undefined;
  try {
    const generated = await generateImage(scene, { env: process.env });
    const normalized = await normalizePhoto(new File([new Uint8Array(generated.bytes)], "generated-image", { type: generated.mimeType }), 12 * 1024 * 1024);
    path = `${crypto.randomUUID()}.webp`;
    const { error: uploadError } = await admin.storage.from(PHOTO_BUCKET).upload(path, normalized.bytes, { contentType: "image/webp" });
    if (uploadError) throw new Error("Could not save image");
    let original: Record<string, unknown> = { scene };
    try { const parsed = JSON.parse(generation.prompt); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) original = parsed; } catch { /* Older posts may have a plain-text prompt. */ }
    const prompt = JSON.stringify({ ...original, photo_path: path, image_origin: "generated", image_model: generated.model, image_prompt: generated.prompt });
    // Claim only the version we read, so a concurrent retry cannot replace an existing image.
    const { data: saved, error: saveError } = await admin.from("generations").update({ prompt }).eq("caption_id", id).eq("user_id", user.id).eq("prompt", generation.prompt).select("id").maybeSingle();
    if (saveError || !saved) {
      const { data: current, error: readError } = await admin.from("generations").select("prompt").eq("caption_id", id).eq("user_id", user.id).maybeSingle();
      // An interrupted response can hide a committed write. Preserve the image until its status is known.
      if (readError) {
        revalidatePath(`/caption/${id}`);
        return { error: "Your image was created, but attaching it could not be confirmed. Refresh this page before trying again." };
      }
      if (current && readPublicBrief(current.prompt).photoPath === path) path = undefined;
      else {
        await admin.storage.from(PHOTO_BUCKET).remove([path]); path = undefined;
        if (!current || !readPublicBrief(current.prompt).photoPath) throw new Error("Could not attach image");
      }
    }
  } catch (error) {
    if (path) await admin.storage.from(PHOTO_BUCKET).remove([path]);
    await admin.from("generation_requests").delete().eq("id", requestId).eq("user_id", user.id);
    return { error: error instanceof ImageGenerationError && error.kind === "blocked" ? "The AI couldn’t create that image. Try a different description in the studio." : "The image providers are unavailable or at their limit. Please try again later. Your existing caption is unchanged." };
  }
  revalidatePath(`/caption/${id}`); revalidatePath("/"); revalidatePath("/collection");
  return { success: "Image added. Your caption and votes are preserved." };
}
