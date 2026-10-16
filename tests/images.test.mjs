import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { generateImage, imageProviderPlan, ImageGenerationError } from "../src/lib/image-providers.ts";
import { captionPrompt, readPublicBrief } from "../src/lib/caption-input.ts";

const env = { CLOUDFLARE_ACCOUNT_ID: "a".repeat(32), CLOUDFLARE_API_TOKEN: "test-cf", GEMINI_API_KEY: "test-google" };
const scene = "A calm dog sitting at a table inside a room with cartoon flames.";

test("the described-image path creates actual image bytes, using Cloudflare first", async () => {
  const jpeg = await sharp({ create: { width: 64, height: 64, channels: 3, background: "blue" } }).jpeg().toBuffer();
  const calls = [];
  const result = await generateImage(scene, { env, fetcher: async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return Response.json({ success: true, result: { image: jpeg.toString("base64") } });
  } });
  assert.match(calls[0].url, /api.cloudflare.com/); assert.equal(calls[0].body.steps, 4);
  assert.ok(calls[0].body.prompt.includes(scene));
  assert.equal((await sharp(result.bytes).metadata()).format, "jpeg");
  assert.match(result.model, /^Cloudflare/);
});

test("image provider quotas fall through to another image model", async () => {
  let calls = 0;
  const result = await generateImage(scene, { env, fetcher: async () => {
    if (++calls === 1) return Response.json({ error: { message: "quota" } }, { status: 429 });
    return Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ inlineData: { mimeType: "image/png", data: "aW1hZ2U=" } }] } }] });
  } });
  assert.equal(calls, 2); assert.match(result.model, /^Gemini/); assert.ok(result.bytes.length);
});

test("a text-only response never counts as a generated image", async () => {
  await assert.rejects(generateImage(scene, { env: { GEMINI_API_KEY: "test" }, fetcher: async () => Response.json({ candidates: [{ content: { parts: [{ text: "Here is your image" }] } }] }) }), error => error.kind === "unavailable");
});

test("no image configuration or exhausted image quotas fail explicitly", async () => {
  assert.equal(imageProviderPlan({ GROQ_API_KEY: "text-only" }).length, 0);
  await assert.rejects(generateImage(scene, { env: {} }), error => error instanceof ImageGenerationError && error.kind === "not_configured");
  await assert.rejects(generateImage(scene, { env, fetcher: async () => Response.json({ error: { message: "quota" } }, { status: 429 }) }), error => error.kind === "rate_limit");
});

test("image safety refusals are not routed around", async () => {
  let calls = 0;
  await assert.rejects(generateImage(scene, { env, fetcher: async () => { calls++; return Response.json({ error: { message: "content_policy violation" } }, { status: 400 }); } }), error => error.kind === "blocked");
  assert.equal(calls, 1);
});

test("image origin and model are recorded without exposing private instructions", () => {
  const prompt = captionPrompt({ scene, direction: "A joke about exams.", photoPath: "b4869a5e-4dfe-423b-8406-fec7a929fada.webp", imageOrigin: "generated", imageModel: "Cloudflare/flux", imagePrompt: "Private image pipeline instructions" });
  assert.equal(JSON.parse(prompt).image_model, "Cloudflare/flux");
  const brief = readPublicBrief(prompt);
  assert.equal(brief.imageOrigin, "generated"); assert.ok(!("imagePrompt" in brief)); assert.equal(brief.scene, scene);
});
