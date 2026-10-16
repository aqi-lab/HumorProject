// Run with: node --env-file=.env.local --import ./tests/register.mjs scripts/check-image.mjs
// Makes real image and caption requests without publishing anything.
import { generateImage } from "../src/lib/image-providers.ts";
import { normalizePhoto } from "../src/lib/photos.ts";
import { generateWithFallback } from "../src/lib/ai-providers.ts";

try {
  const scene = "A pigeon guarding the last empty bench outside a library, playful editorial illustration.";
  const generated = await generateImage(scene, { env: process.env, onFailure: (provider, kind) => console.log("Image provider:", provider, kind) });
  const photo = await normalizePhoto(new File([new Uint8Array(generated.bytes)], "generated-image", { type: generated.mimeType }), 12 * 1024 * 1024);
  console.log("Image OK:", generated.model, "normalized bytes:", photo.bytes.length);
  const caption = await generateWithFallback({ scene, direction: "A dry joke about the pigeon acting like a landlord.", photo: photo.image }, { env: process.env });
  console.log("Caption OK:", caption.model, "caption characters:", caption.caption.length);
} catch (error) { console.error(error.message); process.exitCode = 1; }
