import "server-only";
import { generateWithFallback, providerPlan } from "./ai-providers";
import type { CaptionInput } from "./caption-input";

export function generationIsConfigured(hasPhoto = false) {
  return providerPlan(process.env, hasPhoto).length > 0;
}

export async function createAiCaption(input: CaptionInput) {
  return generateWithFallback(input, { env: process.env, onFailure: error => console.warn("Caption provider failed:", error.message) });
}
