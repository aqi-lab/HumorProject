import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// Exercise the real server action's ownership, persistence and failure boundaries.
const stubUrl = `data:text/javascript,${encodeURIComponent(`
  export const state = {};
  export const createClient = async () => state.client;
  export const createAdminClient = () => { state.adminCalls++; return state.admin; };
  export const revalidatePath = path => state.invalidated.push(path);
  export const normalizePhoto = async () => ({ bytes: Buffer.from("normalized") });
  export class ImageGenerationError extends Error {}
  export const generateImage = async () => {
    if (state.imageFailure) throw new Error("Provider quota exhausted");
    return { bytes: Buffer.from("image"), mimeType: "image/jpeg", model: "Cloudflare/flux", prompt: "Image instructions" };
  };
`)}`;
const mocked = new Set(["next/cache", "@/lib/supabase/server", "@/lib/supabase/admin", "@/lib/image-providers", "@/lib/photos"]);
registerHooks({ resolve(specifier, context, nextResolve) {
  if (mocked.has(specifier)) return { url: stubUrl, shortCircuit: true };
  if (specifier.startsWith("@/")) return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
  return nextResolve(specifier, context);
} });
const { state } = await import(stubUrl);
const { generateMissingImage } = await import("../src/app/caption/[id]/image-actions.ts");
const id = "a5768eb8-c99b-46a3-8450-d5fa072ff731";
const userId = "db9eec69-68db-44e7-ab8a-50b6d976de14";
const original = JSON.stringify({ scene: "A calm dog in a room with cartoon flames.", caption_instructions: "A dry joke about exams." });

function query(result, history) {
  const builder = {};
  for (const method of ["select", "eq", "update", "delete"]) builder[method] = (...args) => { history.push([method, ...args]); return builder; };
  builder.maybeSingle = async () => result;
  builder.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return builder;
}
function setup(options = {}) {
  Object.assign(state, { adminCalls: 0, invalidated: [], removed: [], uploaded: [], mutations: [], reads: [], imageFailure: false, ...options });
  state.client = {
    auth: { getUser: async () => ({ data: { user: options.signedOut ? null : { id: userId } } }) },
    from: table => query({ data: table === "generations" ? options.notOwner ? null : { prompt: original } : { scene: "Original scene fallback." } }, state.reads),
  };
  state.admin = {
    rpc: async () => ({ data: "reservation-id" }),
    from: table => {
      const history = []; state.mutations.push({ table, history });
      const builder = query({ data: options.saveError ? null : { id: "saved" }, error: options.saveError ? { message: "Interrupted" } : null }, history);
      const select = builder.select;
      builder.select = (...args) => {
        if (!history.some(([method]) => method === "update")) return query(options.currentResult || { data: { prompt: original } }, history).select(...args);
        return select(...args);
      };
      return builder;
    },
    storage: { from: () => ({
      upload: async path => { state.uploaded.push(path); return {}; },
      remove: async paths => { state.removed.push(...paths); return {}; },
    }) },
  };
  const form = new FormData(); form.set("caption_id", id); return form;
}

test("missing-image repair verifies sign-in and ownership before using providers", async () => {
  let result = await generateMissingImage({}, setup({ signedOut: true }));
  assert.match(result.error, /Sign in/); assert.equal(state.adminCalls, 0);
  result = await generateMissingImage({}, setup({ notOwner: true }));
  assert.match(result.error, /only.*created/); assert.equal(state.adminCalls, 0);
  assert.ok(state.reads.some(item => item[0] === "eq" && item[1] === "user_id" && item[2] === userId));
});

test("repair attaches only image metadata and preserves caption text, directions and votes", async () => {
  const result = await generateMissingImage({}, setup());
  assert.match(result.success, /votes are preserved/);
  assert.equal(state.uploaded.length, 1); assert.equal(state.removed.length, 0);
  const mutation = state.mutations.find(item => item.history.some(([method]) => method === "update"));
  assert.equal(mutation.table, "generations");
  const payload = mutation.history.find(([method]) => method === "update")[1];
  assert.deepEqual(Object.keys(payload), ["prompt"]);
  const prompt = JSON.parse(payload.prompt);
  assert.equal(prompt.caption_instructions, JSON.parse(original).caption_instructions);
  assert.equal(prompt.photo_path, state.uploaded[0]); assert.equal(prompt.image_origin, "generated");
  assert.ok(mutation.history.some(item => item[0] === "eq" && item[1] === "prompt" && item[2] === original));
  assert.ok(state.mutations.every(item => !["captions", "caption_votes"].includes(item.table)));
});

test("image failure releases its reservation and never attaches a missing asset", async () => {
  const result = await generateMissingImage({}, setup({ imageFailure: true }));
  assert.match(result.error, /existing caption is unchanged/);
  assert.equal(state.uploaded.length, 0);
  assert.ok(state.mutations.some(item => item.table === "generation_requests" && item.history.some(([method]) => method === "delete")));
  assert.ok(!state.mutations.some(item => item.history.some(([method]) => method === "update")));
});

test("ambiguous save responses preserve the possibly attached image", async () => {
  const result = await generateMissingImage({}, setup({ saveError: true, currentResult: { error: { message: "Network unavailable" }, data: null } }));
  assert.match(result.error, /Refresh this page/);
  assert.equal(state.uploaded.length, 1); assert.equal(state.removed.length, 0);
});

test("concurrent repair keeps the winning image and removes only the redundant upload", async () => {
  const winner = "73bcfe11-5815-432b-8499-dcc9549acfac.webp";
  const result = await generateMissingImage({}, setup({ saveError: true, currentResult: { data: { prompt: JSON.stringify({ ...JSON.parse(original), photo_path: winner }) } } }));
  assert.ok(result.success);
  assert.deepEqual(state.removed, state.uploaded); assert.ok(!state.removed.includes(winner));
});
