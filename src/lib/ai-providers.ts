import { captionPrompt, captionSystemPrompt, parseCaptionResult, type CaptionInput } from "./caption-input";

type Env = Record<string, string | undefined>;
type Provider = { name: string; model: string; key: string; url: string; gemini?: boolean };
export class GenerationError extends Error {
  kind: "rate_limit" | "unavailable" | "blocked" | "invalid" | "not_configured";
  provider: string;
  status?: number;
  constructor(kind: GenerationError["kind"], provider = "", status?: number, code?: string) {
    super(`${provider || "AI"}: ${kind}${status ? ` (${status})` : ""}${code && /^[a-z0-9_.-]{1,80}$/i.test(code) ? ` [${code}]` : ""}`);
    this.kind = kind; this.provider = provider; this.status = status;
  }
}

export function providerPlan(env: Env, photo: boolean): Provider[] {
  const plan: Provider[] = [];
  if (env.GEMINI_API_KEY) {
    const models = [...new Set([env.GEMINI_MODEL || "gemini-3.5-flash-lite", env.GEMINI_FALLBACK_MODEL || "gemini-3.1-flash-lite"])];
    for (const model of models) if (/^[a-zA-Z0-9.-]+$/.test(model)) plan.push({ name: "Gemini", model, key: env.GEMINI_API_KEY, url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, gemini: true });
  }
  if (env.GROQ_API_KEY) plan.push({ name: "Groq", model: (photo ? env.GROQ_VISION_MODEL : env.GROQ_MODEL) || (photo ? "qwen/qwen3.8-27b" : "openai/gpt-oss-20b"), key: env.GROQ_API_KEY, url: "https://api.groq.com/openai/v1/chat/completions" });
  if (env.CLOUDFLARE_API_TOKEN && /^[a-f0-9]{32}$/i.test(env.CLOUDFLARE_ACCOUNT_ID || "")) plan.push({ name: "Cloudflare", model: env.CLOUDFLARE_CAPTION_MODEL || "@cf/meta/llama-4-scout-17b-16e-instruct", key: env.CLOUDFLARE_API_TOKEN, url: `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/v1/chat/completions` });
  if (env.OPENROUTER_API_KEY) plan.push({ name: "OpenRouter", model: env.OPENROUTER_MODEL || "openrouter/free", key: env.OPENROUTER_API_KEY, url: "https://openrouter.ai/api/v1/chat/completions" });
  const gatewayKey = env.AI_GATEWAY_API_KEY || env.VERCEL_OIDC_TOKEN;
  if (gatewayKey) plan.push({ name: "AI Gateway", model: env.AI_GATEWAY_MODEL || "google/gemini-2.5-flash-lite", key: gatewayKey, url: "https://ai-gateway.vercel.sh/v1/chat/completions" });
  // Try another provider before a second Gemini model, so one provider's quota cannot block the backup.
  const ordered = [...plan.filter(p => p.name === "Groq" || p.name === "Cloudflare"), ...plan.filter(p => p.gemini && p === plan[0]), ...plan.filter(p => !p.gemini && !["Groq", "Cloudflare"].includes(p.name)), ...plan.filter(p => p.gemini && p !== plan[0])];
  const primary = env.AI_PRIMARY_PROVIDER?.trim().toLowerCase();
  const preferred = primary || (env.GEMINI_API_KEY ? "gemini" : "groq");
  const first = ordered.find(p => p.name.toLowerCase() === preferred);
  return [...(first ? [first] : []), ...ordered.filter(p => p !== first)].slice(0, 5);
}

const schema = { type: "object", properties: { caption: { type: "string" }, scene: { type: "string" } }, required: ["caption", "scene"], additionalProperties: false };

export async function generateWithFallback(input: CaptionInput, options: { env: Env; fetcher?: typeof fetch; onFailure?: (error: GenerationError) => void }) {
  const plan = providerPlan(options.env, !!input.photo);
  if (!plan.length) throw new GenerationError("not_configured");
  const prompt = captionPrompt(input);
  const failures: GenerationError[] = [];
  const attempts = plan.flatMap(provider => provider.name === "Groq" ? [{ ...provider, plainJson: false }, { ...provider, plainJson: true }] : [{ ...provider, plainJson: false }]);
  let retryGroqFormatting = false;
  for (const provider of attempts) {
    if (provider.plainJson && !retryGroqFormatting) continue;
    try {
      const response = await (options.fetcher || fetch)(provider.url, {
        method: "POST", cache: "no-store", signal: AbortSignal.timeout(provider.name === "Cloudflare" ? 25000 : 8000),
        headers: provider.gemini ? { "Content-Type": "application/json", "x-goog-api-key": provider.key } : { "Content-Type": "application/json", Authorization: `Bearer ${provider.key}` },
        body: JSON.stringify(provider.gemini ? {
          systemInstruction: { parts: [{ text: captionSystemPrompt }] },
          contents: [{ role: "user", parts: [{ text: prompt }, ...(input.photo ? [{ inlineData: { mimeType: input.photo.mimeType, data: input.photo.data } }] : [])] }],
          generationConfig: { temperature: 1, maxOutputTokens: 2048, responseMimeType: "application/json", responseSchema: { type: "OBJECT", properties: { caption: { type: "STRING" }, scene: { type: "STRING" } }, required: ["caption", "scene"] } },
        } : {
          model: provider.model, temperature: 1, max_tokens: 2048,
          ...(provider.name === "Groq" && provider.model.includes("gpt-oss") ? { reasoning_effort: "low" } : {}),
          messages: [{ role: "system", content: captionSystemPrompt }, { role: "user", content: input.photo ? [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: `data:${input.photo.mimeType};base64,${input.photo.data}` } }] : prompt }],
          ...(!provider.plainJson ? { response_format: provider.name === "OpenRouter" || (provider.name === "Groq" && !!input.photo) ? { type: "json_object" } : { type: "json_schema", json_schema: { name: "caption", strict: true, schema } } } : {}),
        }),
      });
      if (!response.ok) {
        let detail;
        try { detail = await response.json(); } catch { /* Some providers return plain-text outage pages. */ }
        const code = `${detail?.error?.code || ""} ${detail?.error?.type || ""} ${detail?.error?.message || ""}`;
        if (/content_policy|content_filter|safety|prohibited|moderation/i.test(code)) throw new GenerationError("blocked", provider.name, response.status);
        if (provider.name === "Groq" && !provider.plainJson && detail?.error?.code === "json_validate_failed") retryGroqFormatting = true;
        throw new GenerationError(response.status === 429 ? "rate_limit" : "unavailable", provider.name, response.status, detail?.error?.code);
      }
      const result = await response.json();
      let text: string;
      if (provider.gemini) {
        const candidate = result.candidates?.[0];
        if (result.promptFeedback?.blockReason || ["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "IMAGE_SAFETY"].includes(candidate?.finishReason)) throw new GenerationError("blocked", provider.name);
        if (candidate?.finishReason !== "STOP") throw new GenerationError("invalid", provider.name);
        text = candidate.content?.parts?.filter((part: { thought?: boolean; text?: string }) => !part.thought && typeof part.text === "string").map((part: { text: string }) => part.text).join("");
      } else {
        const choice = result.choices?.[0];
        if (choice?.message?.refusal || choice?.finish_reason === "content_filter") throw new GenerationError("blocked", provider.name);
        if (choice?.finish_reason !== "stop" || typeof choice.message?.content !== "string") throw new GenerationError("invalid", provider.name);
        text = choice.message.content;
      }
      try { return { ...parseCaptionResult(text, input), prompt, model: `${provider.name}/${provider.model}` }; }
      catch { throw new GenerationError("invalid", provider.name); }
    } catch (error) {
      const failure = error instanceof GenerationError ? error : new GenerationError("unavailable", provider.name, undefined, error instanceof Error ? error.name : undefined);
      if (failure.kind === "blocked") throw failure;
      failures.push(failure);
      options.onFailure?.(failure);
    }
  }
  throw new GenerationError(failures.some(f => f.kind === "rate_limit") ? "rate_limit" : "unavailable");
}
