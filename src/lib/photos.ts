import sharp from "sharp";
import { MAX_PHOTO_BYTES, type PhotoInput } from "./caption-input";

export async function normalizePhoto(file: File, maxBytes = MAX_PHOTO_BYTES): Promise<{ bytes: Buffer; image: PhotoInput }> {
  if (!file.size || file.size > maxBytes || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPG, PNG, or WebP photo under 3 MB.");
  try {
    const source = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 20000000, failOn: "error", animated: false });
    const info = await source.metadata();
    if (!["jpeg", "png", "webp"].includes(info.format || "") || (info.pages || 1) > 1) throw new Error("Unsupported image");
    // Re-encoding strips location and other EXIF metadata before upload or AI processing.
    const bytes = await source.rotate().resize(1280, 1280, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    return { bytes, image: { data: bytes.toString("base64"), mimeType: "image/webp" } };
  } catch { throw new Error("This photo couldn’t be read. Choose a different JPG, PNG, or WebP image."); }
}
