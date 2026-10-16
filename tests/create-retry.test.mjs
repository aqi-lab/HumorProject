import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { randomUUID } from "node:crypto";

const stubUrl = `data:text/javascript,${encodeURIComponent(`
  export const state = {};
  export const createClient = async () => ({ auth: { getUser: async () => ({ data: { user: { id: state.userId } } }) } });
  export const createAdminClient = () => state.admin;
  export const generationIsConfigured = () => true;
  export const revalidatePath = () => {};
  export const getCaptionBrief = () => ({});
  export class Redirect extends Error { constructor(path) { super(path); this.path = path; } }
  export const redirect = path => { throw new Redirect(path); };
  export const normalizePhoto = async () => ({ bytes: Buffer.from("normalized-image"), image: {data:"aW1hZ2U=",mimeType:"image/webp"} });
  export class ImageGenerationError extends Error {}
  export const imageProviderPlan = () => [{}];
  export const generateImage = async () => {
    state.imageCalls++;
    return {bytes:Buffer.from("image"),mimeType:"image/jpeg",model:"Cloudflare/flux",prompt:"Private image instructions"};
  };
  export const createAiCaption = async input => {
    state.captionCalls++; state.captionInputs.push(input);
    if(state.failCaption) throw new Error("Caption providers unavailable");
    return {caption:"Rent is due in breadcrumbs.",scene:"A pigeon on an empty bench outside a library.",prompt:JSON.stringify(input),model:"Cloudflare/vision"};
  };
`)}`;
const mocked = new Set(["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin", "@/lib/generation", "@/lib/image-providers", "@/lib/photos", "@/lib/caption-media"]);
registerHooks({ resolve(specifier, context, nextResolve) {
  if (mocked.has(specifier)) return { url: stubUrl, shortCircuit: true };
  if (specifier.startsWith("@/")) return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
  return nextResolve(specifier, context);
} });
const {state, Redirect} = await import(stubUrl);
const {generateCaption} = await import("../src/app/create/actions.ts");
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-draft-secret";
const scene = "A pigeon guarding the last empty bench outside a library.";
function form(token) {
  const data = new FormData(); data.set("input_mode", "scene"); data.set("scene", scene); data.set("direction", "A dry joke about acting like a landlord.");
  if (token) data.set("draft_token", token);
  return data;
}
function setup() {
  Object.assign(state, {userId:randomUUID(),imageCalls:0,captionCalls:0,captionInputs:[],failCaption:true,uploaded:[],removed:[],reservations:[],published:undefined});
  state.admin = {
    rpc: async (name, args) => {
      if (name === "reserve_generation") { const id = randomUUID(); state.reservations.push(id); return {data:id}; }
      state.published = {...args,caption_id:randomUUID()}; return {data:state.published.caption_id};
    },
    from: () => { const q = {select:()=>q,eq:()=>q,maybeSingle:async()=>({data:state.published ? {caption_id:state.published.caption_id} : null})}; return q; },
    storage: {from:()=>({
      upload:async path=>{state.uploaded.push(path);return {};},
      remove:async paths=>{state.removed.push(...paths);return {};},
      createSignedUrl:async path=>({data:{signedUrl:`https://storage.example/${path}`}}),
      download:async()=>({data:new Blob(["saved-image"])})
    })},
  };
}

test("caption outage keeps the image; retry captions that same image and publishes only once", async () => {
  setup();
  const failed = await generateCaption({}, form());
  assert.match(failed.error, /image is saved/); assert.ok(failed.draftToken); assert.ok(failed.draftPhotoUrl);
  assert.equal(state.imageCalls, 1); assert.equal(state.uploaded.length, 1); assert.equal(state.removed.length, 0);
  state.failCaption = false;
  await assert.rejects(generateCaption({}, form(failed.draftToken)), error=>error instanceof Redirect);
  assert.equal(state.imageCalls, 1); assert.equal(state.captionCalls, 2); assert.equal(state.uploaded.length, 1);
  assert.equal(state.captionInputs[1].photoPath, state.uploaded[0]);
  assert.equal(state.published.p_request_id, state.reservations[0]);
  const attempts = state.reservations.length;
  await assert.rejects(generateCaption({}, form(failed.draftToken)), error=>error instanceof Redirect && error.path.endsWith(state.published.caption_id));
  assert.equal(state.reservations.length, attempts); assert.equal(state.captionCalls, 2);
});

test("another account cannot reuse a saved image token, and changing its description needs a new image", async () => {
  setup(); const failed = await generateCaption({}, form());
  const owner = state.userId; state.userId = randomUUID();
  const unauthorized = await generateCaption({}, form(failed.draftToken));
  assert.match(unauthorized.error, /expired|changed/); assert.equal(state.imageCalls, 1);
  state.userId = owner; const changed = form(failed.draftToken); changed.set("scene", "An entirely different scene with a dog and a desk.");
  assert.match((await generateCaption({}, changed)).error, /description changed/);
  assert.equal(state.imageCalls, 1);
});
