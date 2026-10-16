import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/site-header";
import { CaptionCard } from "@/components/caption-card";
import { uuidPattern, type Caption } from "@/lib/humor";

export const metadata = { title: "A little city chaos | Only in New York" };
export default async function CaptionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ compare?: string }> }) {
  const [{ id }, { compare }] = await Promise.all([params, searchParams]);
  if (!uuidPattern.test(id)) notFound();
  const compareId = typeof compare === "string" && uuidPattern.test(compare) && compare !== id ? compare : null;
  const supabase = await createClient();
  const [{ data: { user } }, { data, error }, comparisonResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("caption_feed", { p_id: id }),
    compareId ? supabase.rpc("caption_feed", { p_id: compareId }) : Promise.resolve({ data: null, error: null }),
  ]);
  if (error) throw new Error("The caption could not be loaded.");
  const caption = (data as Caption[] | null)?.[0];
  if (!caption) notFound();
  const comparison = (comparisonResult.data as Caption[] | null)?.[0];
  const original = !comparisonResult.error && comparison?.scene === caption.scene ? comparison : null;
  const visibleIds = original ? [id, original.id] : [id];
  const [voteResult, generationResult] = user ? await Promise.all([
    supabase.from("caption_votes").select("caption_id,value").eq("user_id", user.id).in("caption_id", visibleIds),
    supabase.from("generations").select("prompt,system_prompt,model").eq("user_id", user.id).eq("caption_id", id).maybeSingle(),
  ]) : [{ data: [], error: null }, { data: null, error: null }];
  const myVotes = new Map(voteResult.data?.map(vote => [vote.caption_id, vote.value]));

  return <div className="ny-app"><SiteHeader signedIn={!!user}/><main className={`caption-detail${original ? " comparison-detail" : ""}`}>
    <Link href="/" className="back-link">← Back to the feed</Link>
    <p className="eyebrow">{original ? "ONE SCENE, TWO PUNCHLINES" : "FRESH FROM THE GROUP CHAT"}</p>
    <h1>{original ? "Which one lands?" : "Did it land?"}</h1>
    {original && <p className="comparison-intro">Here’s the original and the new AI remix. Vote Funny or Miss on either one.</p>}
    {voteResult.error && <p role="alert" className="form-status">Your saved votes could not be loaded. Refresh before voting again.</p>}
    {original ? <div className="comparison-grid"><section><h2>Original caption</h2><CaptionCard caption={original} signedIn={!!user} myVote={myVotes.get(original.id)} returnPath={`/caption/${id}?compare=${original.id}`} index={1}/></section><section><h2>New remix</h2><CaptionCard caption={caption} signedIn={!!user} myVote={myVotes.get(id)} sharePath={`/caption/${id}?compare=${original.id}`} returnPath={`/caption/${id}?compare=${original.id}`}/></section></div>
      : <CaptionCard caption={caption} signedIn={!!user} myVote={myVotes.get(id)}/>}
    {generationResult.data && <details className="prompt-details"><summary>Your generation recipe · only visible to you</summary><p>Model: {generationResult.data.model}</p><h2>Scene & style prompt</h2><pre>{generationResult.data.prompt}</pre><h2>Writing instructions</h2><p>{generationResult.data.system_prompt}</p></details>}
    <Link href={original ? `/create?remix=${original.id}` : "/create"} className="secondary-button">{original ? "Try another remix ↗" : "Make your own caption ↗"}</Link>
  </main></div>;
}
