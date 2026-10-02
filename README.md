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
