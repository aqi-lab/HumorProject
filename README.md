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
