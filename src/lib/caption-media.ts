import "server-only";
import { createAdminClient } from "./supabase/admin";
import { PHOTO_BUCKET, readPublicBrief } from "./caption-input";
import type { Caption } from "./humor";

export async function getCaptionBrief(id: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("generations").select("prompt").eq("caption_id", id).maybeSingle();
  if (error) throw new Error("Could not load the caption brief");
  return readPublicBrief(data?.prompt || "{}");
}

export async function withCaptionMedia(captions: Caption[]): Promise<Caption[]> {
  if (!captions.length || !process.env.SUPABASE_SERVICE_ROLE_KEY) return captions;
  const admin = createAdminClient();
  const { data, error } = await admin.from("generations").select("caption_id,prompt").in("caption_id", captions.map(caption => caption.id));
  if (error) throw new Error("Caption photos and instructions could not be loaded");
  const briefs = new Map(data?.map(row => [row.caption_id, readPublicBrief(row.prompt)]));
  const paths = [...new Set([...briefs.values()].flatMap(brief => brief.photoPath ? [brief.photoPath] : []))];
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data: signed, error: signError } = await admin.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 3600);
    if (signError) throw new Error("Caption photos could not be loaded");
    for (const item of signed || []) if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }
  return captions.map(caption => {
    const brief = briefs.get(caption.id);
    return { ...caption, input_scene: brief?.scene, caption_instructions: brief?.direction || undefined, photo_url: brief?.photoPath ? urls.get(brief.photoPath) : undefined, source_caption_id: brief?.sourceId };
  });
}
