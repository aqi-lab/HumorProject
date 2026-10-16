import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { generateWithFallback, GenerationError, providerPlan } from "../src/lib/ai-providers.ts";
import { readPublicBrief, validateCaptionInput, captionPrompt } from "../src/lib/caption-input.ts";
import { normalizePhoto } from "../src/lib/photos.ts";

const input = { scene: "A pigeon sits on an empty library bench.", direction: "A dry joke about acting like a landlord." };
const keys = { GEMINI_API_KEY: "test-google", GROQ_API_KEY: "test-groq" };
const success = (scene = input.scene) => Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ caption: "Rent is due in breadcrumbs.", scene }) } }] });

test("Gemini quota failures fall through to Groq within one generation", async () => {
  const calls = [];
  const result = await generateWithFallback(input, { env: keys, fetcher: async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return calls.length === 1 ? new Response("quota", { status: 429 }) : success();
  } });
  assert.equal(calls.length, 2);
  assert.match(calls[1].url, /api.groq.com/);
  assert.equal(result.model, "Groq/openai/gpt-oss-20b");
  assert.equal(JSON.parse(result.prompt).caption_instructions, input.direction);
  assert.ok(!result.prompt.includes("test-groq"));
});

test("photo fallbacks send image data to a vision model and preserve context", async () => {
  const calls = [];
  const result = await generateWithFallback({ ...input, photo: { mimeType: "image/webp", data: "cGhvdG8=" } }, { env: keys, fetcher: async (url, options) => {
    calls.push(JSON.parse(options.body));
    if (calls.length === 1) throw new DOMException("timeout", "TimeoutError");
    return success("A pigeon guards a wooden bench outside a library.");
  } });
  assert.match(calls[1].model, /qwen/);
  assert.match(calls[1].messages[1].content[1].image_url.url, /^data:image\/webp;base64,/);
  assert.equal(result.scene, "A pigeon guards a wooden bench outside a library.");
});

test("Groq request rejection uses Cloudflare vision before unavailable Gemini backups", async () => {
  const calls = [];
  const env = { ...keys, AI_PRIMARY_PROVIDER: "groq", CLOUDFLARE_ACCOUNT_ID: "a".repeat(32), CLOUDFLARE_API_TOKEN: "test-cf" };
  const result = await generateWithFallback({ ...input, photo: { mimeType: "image/webp", data: "cGhvdG8=" } }, { env, fetcher: async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    if (calls.length === 1) return Response.json({ error: { code: "json_validate_failed", message: "Failed to generate JSON" } }, { status: 400 });
    return success("A pigeon guards a wooden bench outside a library.");
  } });
  assert.equal(calls.length, 2); assert.match(calls[1].url, /api.cloudflare.com/);
  assert.match(calls[1].body.model, /llama-4-scout/);
  assert.match(calls[1].body.messages[1].content[1].image_url.url, /^data:image\/webp;base64,/);
  assert.equal(calls[1].body.response_format.type, "json_schema");
  assert.match(result.model, /^Cloudflare/);
});

test("safety refusals stop instead of trying to bypass another provider", async () => {
  let calls = 0;
  await assert.rejects(generateWithFallback(input, { env: keys, fetcher: async () => {
    calls++; return Response.json({ promptFeedback: { blockReason: "SAFETY" } });
  } }), error => error instanceof GenerationError && error.kind === "blocked");
  assert.equal(calls, 1);
});

test("malformed output uses the backup instead of publishing broken content", async () => {
  let calls = 0;
  const result = await generateWithFallback(input, { env: keys, fetcher: async () => ++calls === 1 ? Response.json({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: "not json" }] } }] }) : success() });
  assert.equal(calls, 2); assert.match(result.model, /Groq/);
});

test("exhausted providers produce a specific capacity error", async () => {
  await assert.rejects(generateWithFallback(input, { env: keys, fetcher: async () => new Response("busy", { status: 429 }) }), error => error.kind === "rate_limit");
});

test("a backup key can run the studio without Gemini and keys never enter prompts", () => {
  const plan = providerPlan({ GROQ_API_KEY: "backup" }, false);
  assert.equal(plan.length, 1); assert.equal(plan[0].name, "Groq");
  assert.equal(readPublicBrief(JSON.stringify({ ...input, system_prompt: "private", user_id: "private", caption_instructions: input.direction })).direction, input.direction);
  assert.deepEqual(Object.keys(readPublicBrief("{}")), ["scene", "direction", "photoPath", "sourceId", "imageOrigin"]);
  assert.equal(readPublicBrief('{"scene":"Original photo context","caption_instructions":"Make it dry."}').scene, "Original photo context");
  assert.equal(readPublicBrief('{"photo_path":"../../private.webp"}').photoPath, undefined);
  assert.equal(providerPlan({ ...keys, AI_PRIMARY_PROVIDER: "groq" }, false)[0].name, "Groq");
});

test("instructions are required, while a photo needs no written image description", () => {
  assert.ok(validateCaptionInput("", "", true).error);
  assert.ok(!validateCaptionInput("", "Make it dry.", true).error);
  assert.ok(validateCaptionInput("short", "Make it dry.", false).error);
  const copied = JSON.parse(captionPrompt({ ...input, sourceId: "b4869a5e-4dfe-423b-8406-fec7a929fada" }));
  assert.equal(copied.scene, input.scene);
  assert.ok(!("existing_caption_to_avoid" in copied));
});

test("photos are decoded, resized, stripped of metadata, and spoofed files fail", async () => {
  const bytes = await sharp({ create: { width: 1800, height: 1400, channels: 3, background: "green" } }).jpeg().withMetadata().toBuffer();
  const photo = await normalizePhoto(new File([bytes], "photo.jpg", { type: "image/jpeg" }));
  const metadata = await sharp(photo.bytes).metadata();
  assert.equal(metadata.format, "webp"); assert.ok(metadata.width <= 1280); assert.equal(metadata.exif, undefined);
  await assert.rejects(normalizePhoto(new File(["not a photo"], "fake.jpg", { type: "image/jpeg" })));
  await assert.rejects(normalizePhoto(new File([new Uint8Array(3 * 1024 * 1024 + 1)], "huge.jpg", { type: "image/jpeg" })));
});

test("one switch disables prompt reuse while normal creation still resolves", async () => {
  process.env.NEXT_PUBLIC_ENABLE_REMIX = "false";
  const feature = await import("../src/features/reuse-prompt.ts?disabled");
  assert.equal(feature.reusePromptEnabled, false);
  delete process.env.NEXT_PUBLIC_ENABLE_REMIX;
});
