import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { withCaptionMedia } from "@/lib/caption-media";
import { SiteHeader } from "@/components/site-header";
import { CaptionCard } from "@/components/caption-card";
import { uuidPattern, type Caption } from "@/lib/humor";
import { GenerateImageForm } from "./generate-image-form";
import { readPublicBrief } from "@/lib/caption-input";

export const metadata = { title: "A little city chaos | Only in New York" };
export const maxDuration = 120;
export default async function CaptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidPattern.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: { user } }, { data, error }] = await Promise.all([supabase.auth.getUser(), supabase.rpc("caption_feed", { p_id: id })]);
  if (error) throw new Error("The caption could not be loaded.");
  const row = (data as Caption[] | null)?.[0];
  if (!row) notFound();
  const [caption] = await withCaptionMedia([row]);
  const [voteResult, generationResult] = user ? await Promise.all([
    supabase.from("caption_votes").select("value").eq("user_id", user.id).eq("caption_id", id).maybeSingle(),
    supabase.from("generations").select("prompt,system_prompt,model").eq("user_id", user.id).eq("caption_id", id).maybeSingle(),
  ]) : [{ data: null, error: null }, { data: null, error: null }];
  return <div className="ny-app"><SiteHeader signedIn={!!user}/><main className="caption-detail">
    <Link href="/" className="back-link">← Back to the feed</Link><p className="eyebrow">FRESH FROM THE GROUP CHAT</p><h1>Did it land?</h1>
    {voteResult.error && <p role="alert" className="form-status">Your saved vote could not be loaded. Refresh before voting again.</p>}
    <CaptionCard caption={caption} signedIn={!!user} myVote={voteResult.data?.value}/>
    {generationResult.data && !readPublicBrief(generationResult.data.prompt).photoPath && <GenerateImageForm captionId={id}/>}
    {generationResult.data && <details className="prompt-details"><summary>Your generation recipe · only visible to you</summary><p>Model: {generationResult.data.model}</p><h2>Your prompt record</h2><pre>{generationResult.data.prompt}</pre><h2>Writing instructions</h2><p>{generationResult.data.system_prompt}</p></details>}
    <Link href="/create" className="secondary-button">Make your own caption ↗</Link>
  </main></div>;
}
