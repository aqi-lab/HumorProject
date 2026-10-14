import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { CaptionCard } from "@/components/caption-card";
import { createClient } from "@/lib/supabase/server";
import { type Caption } from "@/lib/humor";

export const metadata = { title: "My collection | Only in New York" };

export default async function CollectionPage({ searchParams }: { searchParams: Promise<{ view?: string; page?: string }> }) {
  const { view, page: rawPage } = await searchParams;
  const liked = view === "liked";
  const page = Math.min(100, Math.max(0, Number.parseInt(rawPage || "0", 10) || 0));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(liked ? "/collection?view=liked" : "/collection")}`);

  const query = liked
    ? supabase.from("caption_votes").select("caption_id,value").eq("user_id", user.id).eq("value", 1).order("created_at", { ascending: false }).range(page * 12, page * 12 + 12)
    : supabase.from("generations").select("caption_id").eq("user_id", user.id).order("created_at", { ascending: false }).range(page * 12, page * 12 + 12);
  const { data: rows, error: listError } = await query;
  const ids = (rows || []).slice(0, 12).map(row => row.caption_id);
  // The feed RPC is the public source of truth for live aggregate scores.
  const captionResults = await Promise.all(ids.map(id => supabase.rpc("caption_feed", { p_id: id })));
  const captions = captionResults.map(result => (result.data as Caption[] | null)?.[0]).filter((caption): caption is Caption => Boolean(caption));
  const { data: votes, error: votesError } = captions.length
    ? await supabase.from("caption_votes").select("caption_id,value").eq("user_id", user.id).in("caption_id", captions.map(caption => caption.id))
    : { data: [], error: null };
  const myVotes = new Map(votes?.map(vote => [vote.caption_id, vote.value]));
  const dataError = listError || votesError || captionResults.find(result => result.error)?.error;
  const base = liked ? "/collection?view=liked" : "/collection";
  const pageLink = (target: number) => `${base}${liked ? "&" : "?"}page=${target}`;

  return <div className="ny-app"><SiteHeader signedIn/><main className="collection-main">
    <p className="eyebrow">YOUR CORNER OF THE CITY</p><h1>My collection<span className="brand-period">.</span></h1>
    <p className="collection-description">Come back for the captions you made and the ones that made you laugh.</p>
    <nav className="feed-tabs collection-tabs" aria-label="Collection views"><Link href="/collection" aria-current={!liked ? "page" : undefined}>Made by me</Link><Link href="/collection?view=liked" aria-current={liked ? "page" : undefined}>Voted funny</Link></nav>
    {dataError ? <div className="empty-state" role="alert"><h2>We couldn’t load your collection.</h2><p>Please try again in a moment.</p><Link href={base} className="secondary-button">Try again</Link></div>
      : captions.length ? <div className="caption-grid">{captions.map((caption, index) => <CaptionCard key={caption.id} caption={caption} signedIn myVote={myVotes.get(caption.id)} index={index}/>)}</div>
      : <div className="empty-state"><span aria-hidden>✳</span><h2>{liked ? "No favorites yet." : "Your first caption is waiting."}</h2><p>{liked ? "Vote Funny on a caption and it’ll appear here." : "Give the AI a scene and see what it writes."}</p><Link href={liked ? "/" : "/create"} className="secondary-button">{liked ? "Browse captions ↗" : "Make a caption ↗"}</Link></div>}
    <nav aria-label="Collection pages" className="pagination">{page > 0 && <Link href={pageLink(page - 1)}>← Previous</Link>}{(rows?.length || 0) > 12 && <Link href={pageLink(page + 1)}>More captions →</Link>}</nav>
  </main></div>;
}
