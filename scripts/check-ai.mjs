// Run with: node --env-file=.env.local --import ./tests/register.mjs scripts/check-ai.mjs
import sharp from "sharp";
import { generateWithFallback } from "../src/lib/ai-providers.ts";

const scene = "A pigeon is guarding the only empty bench outside a library.";
const direction = "Make a dry joke about the pigeon acting like a landlord.";
const svg = '<svg width="640" height="480" xmlns="http://www.w3.org/2000/svg"><rect width="640" height="480" fill="#f7eddd"/><rect x="150" y="150" width="260" height="230" rx="22" fill="#c4352a"/><ellipse cx="280" cy="150" rx="130" ry="36" fill="#502e1e"/><text x="175" y="295" font-size="35" fill="white">$9 COFFEE</text></svg>';
const bytes = await sharp(Buffer.from(svg)).webp().toBuffer();
const jobs = [
  ["Configured provider chain", { scene, direction }, process.env],
  ["Groq text", { scene, direction }, { GROQ_API_KEY: process.env.GROQ_API_KEY }],
  ["Groq photo", { scene: "", direction: "Make a short joke about the price of this coffee.", photo: { data: bytes.toString("base64"), mimeType: "image/webp" } }, { GROQ_API_KEY: process.env.GROQ_API_KEY }],
];
for (const [label, input, env] of jobs) {
  try {
    const output = await generateWithFallback(input, { env, onFailure: error => console.log(label, error.message) });
    console.log(label, "OK", output.model, "caption characters:", output.caption.length, "scene characters:", output.scene.length);
  } catch (error) { console.error(label, error.message); process.exitCode = 1; }
}
