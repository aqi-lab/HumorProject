# Humor Project — Hello World

A simple Next.js app for the Week 1 assignment in Designing for GenAI.

## Run locally

This project uses Node.js 22.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run build
```

# Week 2: Supabase jokes

The existing Hello World home page links to `/jokes`, a live list loaded from a Supabase `public.jokes` table.

1. Create a Supabase project and run [`supabase/schema.sql`](supabase/schema.sql) in its SQL Editor. This creates four sample rows and grants read-only public access through row level security.
2. Copy `.env.example` to `.env.local` and set `SUPABASE_URL` and `SUPABASE_ANON_KEY` from the project's Connect dialog. A current Supabase publishable key works in the `SUPABASE_ANON_KEY` variable. Keep `.env.local` out of Git.
3. Set the same two environment variables in the Vercel project for Production and Preview. Redeploy after setting them.
4. Run `npm run dev` and visit `/jokes` to confirm the rows load.

The `/jokes` page fetches data on each request. The public key can only select rows from this table; the SQL does not grant public insert, update, or delete access.

## Week 3: Google sign-in and profiles

The home page links to `/members`. That route verifies a Supabase session on the server. New users are sent to `/profile` until they add a first and last name. The profile editor also uploads a photo to a private Supabase Storage bucket; the database only stores its path.

1. In the **same Supabase project**, run [`supabase/week3.sql`](supabase/week3.sql) in the SQL Editor. It creates `public.profiles`, a trigger on `auth.users`, policies, and an `avatars` Storage bucket. It also adds profile rows for any existing users.
2. In Google Cloud, create a **Web application** OAuth client. Add your app's origin (for example, `https://your-app.vercel.app` and `http://localhost:3000`) as authorized JavaScript origins. Set the **Google authorized redirect URI** to the Supabase callback shown in **Supabase → Authentication → Providers → Google**: `https://<project-ref>.supabase.co/auth/v1/callback`. Add the new Client ID and Client Secret to that Google provider and enable it. Google needs the `openid`, email, and profile scopes.
3. In **Supabase → Authentication → URL Configuration**, add your deployed app's exact `https://your-app.vercel.app/auth/callback` and local `http://localhost:3000/auth/callback` to the redirect allow list. The app always sends `/auth/callback` as `redirectTo`, with no extra query parameters. The Google redirect URI in step 2 is different because Google first returns to Supabase, which then returns to the app.
4. Keep `SUPABASE_URL` and `SUPABASE_ANON_KEY` set locally and in the existing Vercel project. Deploy the new commit. In Vercel, disable Deployment Protection for the app if the submission must open in Incognito Mode.
5. Test in a private window: open `/members`, confirm it sends you to sign-in, use Google, complete both name fields, upload a photo, and revisit `/members`. Submit the **commit-specific** Vercel deployment URL, not the alias that changes with each deployment.

## Week 4: Only in New York

The home page is now a public feed of AI-written captions. Signed-in users can use the caption studio to write a scene or today's rotating NYC prompt, generate a caption with Gemini (directly or through Vercel AI Gateway), and vote **Funny** or **Miss** on captions. Each account gets one changeable vote per caption. The public feed includes Fresh, Top rated, and Today's prompt views and shareable caption links. The exact prompt, writing instructions, and model are stored with each generation and visible only to its creator.

1. In the existing Supabase project, run [`supabase/week4.sql`](supabase/week4.sql) in the SQL Editor after the previous migrations. It creates captions, private generation records, generation reservations, and votes. It enables RLS on all application tables in `public`; grants and policies allow public caption reading, authenticated voting on one's own record, and private prompt history. Only the server's service role can publish AI output. The database enforces a 10-attempt daily limit using New York time.
2. Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` and the Vercel project's **Production** environment variables. Keep it server-only. Vercel automatically provides `VERCEL_OIDC_TOKEN` for AI Gateway in production, but AI Gateway credit must be activated in the account first. As an alternative, add `GEMINI_API_KEY` to `.env.local` and the Vercel Production and Preview environments; this takes precedence over AI Gateway and does not require a payment card. For local AI generation, add either `AI_GATEWAY_API_KEY` or `GEMINI_API_KEY` to `.env.local`. `AI_GATEWAY_MODEL` optionally overrides the default `google/gemini-2.5-flash-lite`. The Supabase URL and anon key from earlier weeks remain required.
3. Build with Node 22 or later, then deploy. Test `/` signed out, `/create` signed in, one generation, both vote choices, prompt visibility on your own caption page, and the shared link in an incognito window. Verify Vercel project **Deployment Protection** has “Require Log In” off for public access, and submit the unique deployment URL for the commit.

A failed AI request still consumes one attempt, which prevents repeated abusive calls. The scene is public; users should leave out personal details. Each generation is capped at one caption and a short input.

## Week 5: simpler creation and a reason to return

Feedback showed that choosing a caption “flavor” made the studio less intuitive. The studio now asks for just a scene; it uses a consistent writing style behind the scenes. Signed-in users can revisit captions they created and captions they voted Funny on from **My collection**. Voting and sharing remain available on each card. A sign-in started from a caption or the daily prompt returns to that same place afterward. These changes use the existing Week 4 tables and policies; no new SQL is required.

Before submitting, verify the public deployment in a private window and use its commit-specific Vercel URL. Test sign-in, one generation, Funny and Miss voting, the collection, and a public caption link. Vercel Deployment Protection must allow public access for the assignment.

## Photo captions, caption instructions, and AI fallback

The studio has two paths: upload a JPG/PNG/WebP photo under 3 MB, or describe an image for AI to generate. Both paths ask what the caption should be like. The description path first generates a real image, then sends that image to a vision model for captioning, and publishes both together. A failed image request never publishes a caption-only post and releases its daily reservation. Images are decoded, resized, and re-encoded without EXIF metadata before captioning or storage. Images, descriptions, caption instructions and the AI caption are public after publishing. The full system prompt, provider/model and account identity remain private.

For image generation, add `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` to local and Vercel Production environments. Create a Workers AI token using [Cloudflare’s REST API setup](https://developers.cloudflare.com/workers-ai/get-started/rest-api/). Cloudflare Flux.1 Schnell is tried first. If `GEMINI_API_KEY` is configured, Gemini’s image model is a backup; image generation needs its own available quota and is separate from Gemini text generation. `GEMINI_IMAGE_MODEL` optionally changes the image model. Groq supplies captions, not image generation. No automatic billing changes are made. Redeploy after changing production settings.

Owners of older caption-only posts see **Generate missing image** on the caption page. It generates an image from the original description and attaches it without changing the caption or votes. This action verifies ownership on the server and uses the existing daily generation limit. No SQL migration is needed.

Run `node --env-file=.env.local scripts/setup-photo-storage.mjs` once against the existing Supabase project. It creates a private `caption-photos` bucket using the server service role. Browser clients have no direct upload/list permission. Published caption pages receive expiring image URLs. The structured JSON prompt record stores the opaque photo reference and public caption instructions; the server exposes only these approved public fields. Existing captions need no migration.

Configure `GROQ_API_KEY` in local and Vercel Production environments. Set `AI_PRIMARY_PROVIDER=groq` to use the verified Groq models first. The app falls back through other configured providers (Gemini, OpenRouter, Vercel AI Gateway), including a secondary Gemini model. Without this setting, Gemini is tried first. It supports both text and vision. Each provider has an 8-second timeout; fallback remains within the same daily generation reservation. Invalid output, network failures, provider errors, and quotas trigger fallback. Content safety refusals stop immediately. The saved model identifies the provider that actually succeeded. A free provider can still reach its own quota; the app explains when all configured options fail.

Optional settings are listed in `.env.example`. Provider credentials stay server-only. Vercel OIDC requires active AI Gateway credit to work.

### Disable or remove prompt reuse

The old Remix comparison flow has been removed. **Reuse prompt** copies the public description and caption instructions into editable fields. For generated images, editing the description creates a new image. Uploaded photos are copied and can be replaced. It never uses the original AI caption as a new writing instruction and never reveals another user's private generation record.

Set `NEXT_PUBLIC_ENABLE_REMIX=false` in Vercel and redeploy to hide the link and reject reuse requests. Old reuse links lead to the ordinary studio. The single switch and URL helper live in `src/features/reuse-prompt.ts`; normal creation, photo storage, AI fallback, votes and collections do not depend on reuse. Existing captions and photos remain available when it is off.

### Verification

Use Node 22.18+ or 24 for `npm test`, `npm run lint`, and `npm run build`. Tests cover caption and image provider quota/invalid-response fallback, refusal handling, real image bytes versus text-only output, photo validation and metadata stripping, public prompt-field boundaries, and the feature switch. A live caption provider check is available with `node --env-file=.env.local --import ./tests/register.mjs scripts/check-ai.mjs`. Use `scripts/check-image.mjs` with the same flags for a real image-to-caption check. These checks do not publish posts.
