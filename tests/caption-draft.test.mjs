import test from "node:test";
import assert from "node:assert/strict";
import { sealCaptionDraft, openCaptionDraft } from "../src/lib/caption-draft.ts";

const secret = "server-only-test-secret";
const draft = {
  userId: "owner", requestId: "a5768eb8-c99b-46a3-8450-d5fa072ff731", scene: "A pigeon guarding the last empty bench.",
  photoPath: "73bcfe11-5815-432b-8499-dcc9549acfac.webp", imageModel: "Cloudflare/flux", imagePrompt: "Private image instructions", expiresAt: 10000,
};

test("saved-image retries are encrypted and bound to the authenticated owner", () => {
  const token = sealCaptionDraft(draft, secret);
  assert.deepEqual(openCaptionDraft(token, secret, "owner", 1), draft);
  assert.equal(openCaptionDraft(token, secret, "someone-else", 1), undefined);
  assert.equal(openCaptionDraft(token, "wrong-secret", "owner", 1), undefined);
  assert.ok(!token.includes(draft.photoPath));
});

test("tampered, expired or malformed saved-image references cannot access private images", () => {
  const token = sealCaptionDraft(draft, secret);
  assert.equal(openCaptionDraft(token.slice(0, 50) + (token[50] === "a" ? "b" : "a") + token.slice(51), secret, "owner", 1), undefined);
  assert.equal(openCaptionDraft(token, secret, "owner", 10000), undefined);
  assert.equal(openCaptionDraft(sealCaptionDraft({ ...draft, photoPath: "../../private.webp" }, secret), secret, "owner", 1), undefined);
});
