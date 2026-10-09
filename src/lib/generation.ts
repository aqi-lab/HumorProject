import "server-only";
import { generationPrompt, parseCaption, systemPrompt, type HumorStyle } from "@/lib/humor";

/** Vercel supplies OIDC automatically in deployments. A provider key is optional for local use. */
export async function createAiCaption(scene: string, style: HumorStyle) {
  const prompt = generationPrompt(scene, style);
  const gatewayToken = process.env.GEMINI_API_KEY ? undefined : (process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
  if (gatewayToken) {
    const model = process.env.AI_GATEWAY_MODEL || "google/gemini-2.5-flash-lite";
    if (!/^[a-zA-Z0-9./-]+$/.test(model)) throw new Error("Invalid gateway model configuration");
    const response = await fetch("https://ai-gateway.vercel.sh/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${gatewayToken}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }],
        temperature: 1,
        max_tokens: 1024,
        response_format: {
          type: "json_schema",
          json_schema: { name: "nyc_caption", strict: true, schema: { type: "object", properties: { caption: { type: "string" } }, required: ["caption"], additionalProperties: false } },
        },
      }),
      signal: AbortSignal.timeout(25000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`AI Gateway status ${response.status}: ${(await response.text()).slice(0, 180)}`);
    const result = await response.json();
    const choice = result.choices?.[0];
    if (choice?.finish_reason !== "stop" || typeof choice.message?.content !== "string") throw new Error("Incomplete or blocked AI response");
    return { caption: parseCaption(choice.message.content), prompt, model };
  }

  // A configured Gemini key takes precedence over AI Gateway in any environment.
  if (!process.env.GEMINI_API_KEY) throw new Error("AI provider is not configured");
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  if (!/^[a-zA-Z0-9.-]+$/.test(model)) throw new Error("Invalid Gemini model configuration");
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 1, maxOutputTokens: 1024, responseMimeType: "application/json", responseSchema: { type: "OBJECT", properties: { caption: { type: "STRING" } }, required: ["caption"] } },
    }),
    signal: AbortSignal.timeout(25000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Gemini status ${response.status}`);
  const result = await response.json();
  const candidate = result.candidates?.[0];
  if (candidate?.finishReason !== "STOP") throw new Error("Incomplete or blocked AI response");
  const text = candidate.content?.parts?.filter((part: { thought?: boolean; text?: string }) => !part.thought && typeof part.text === "string").map((part: { text: string }) => part.text).join("");
  return { caption: parseCaption(text), prompt, model };
}
