import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { uuidPattern, type ActionState } from "./humor";

export type CaptionDraft = {
  userId: string; requestId: string; scene: string; photoPath: string;
  imageModel: string; imagePrompt: string; sourceId?: string; expiresAt: number;
};
export type GenerationState = ActionState & { draftToken?: string; draftPhotoUrl?: string };
const key = (secret: string) => createHash("sha256").update(`caption-draft-v1:${secret}`).digest();

// Authenticated encryption keeps the private image reference bound to its creator.
export function sealCaptionDraft(draft: CaptionDraft, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(draft), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}

export function openCaptionDraft(token: string, secret: string, userId: string, now = Date.now()): CaptionDraft | undefined {
  try {
    if (token.length > 6000 || token.length < 40) return;
    const bytes = Buffer.from(token, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key(secret), bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const draft = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8"));
    if (draft.userId !== userId || !uuidPattern.test(draft.requestId) || typeof draft.expiresAt !== "number" || draft.expiresAt <= now) return;
    if (typeof draft.scene !== "string" || draft.scene.length < 12 || draft.scene.length > 400 || typeof draft.photoPath !== "string" || !draft.photoPath.endsWith(".webp") || !uuidPattern.test(draft.photoPath.slice(0, -5))) return;
    if (typeof draft.imageModel !== "string" || draft.imageModel.length > 200 || typeof draft.imagePrompt !== "string" || draft.imagePrompt.length > 2000 || (draft.sourceId && !uuidPattern.test(draft.sourceId))) return;
    return draft;
  } catch { return; }
}
