import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { dailyChallenge, type Caption } from "@/lib/humor";
import { SiteHeader } from "@/components/site-header";
import { CaptionCard } from "@/components/caption-card";

export const maxDuration = 60;
export default async function Home({ searchParams }: { searchParams: Promise<{ sort?: string; page?: string }> }) {
  const params = await searchParams;
  const sort = ["top", "today"].includes(params.sort || "") ? params.sort! : "new";
  const page = Math.min(1000, Math.max(0, Number.parseInt(params.page || "0", 10) || 0));
  const challenge = dailyChallenge();
  const supabase = await createClient();
  const [{ data: { user } }, { data, error }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("caption_feed", { p_sort: sort, p_day: sort === "today" ? challenge.date : null, p_offset: page * 12 }),
  ]);
  const captions = (data || []) as Caption[];
  const visible = captions.slice(0, 12);
  const { data: votes, error: votesError } = user && visible.length ? await supabase.from("caption_votes").select("caption_id,value").eq("user_id", user.id).in("caption_id", visible.map(c => c.id)) : { data: [], error: null };
  const myVotes = new Map(votes?.map(v => [v.caption_id, v.value]));
  return <div className="ny-app"><SiteHeader signedIn={!!user}/>
    <main className="feed-main">
      <section className="hero"><div className="hero-copy"><p className="eyebrow"><span className="live-dot"/> CAMPUS LORE. CITY CHAOS. QUESTIONABLE TAKES.</p><h1>Big city.<br/>Small <span>punchlines.</span></h1><p className="hero-description">For the moments that belong in the group chat.<br/>You set the scene. AI writes the caption. We judge.</p><Link href="/create" className="primary-button">Make something funny <span aria-hidden>↗</span></Link><span className="hero-footnote">Made for the chronically online, uptown edition.</span></div>
      <aside className="daily-card"><div className="daily-top"><span>THE DAILY PROMPT</span><span aria-hidden>✳</span></div><p className="daily-date">{new Date(`${challenge.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })} / NEW YORK, NY</p><h2>{challenge.scene}</h2><div className="daily-bottom"><span>Same scene.<br/>A different kind of funny.</span><Link href="/create?daily=1" aria-label="Try today's prompt">↗</Link></div><p className="daily-reset">A new prompt every midnight, NYC time.</p></aside></section>
      <section className="feed-section" aria-labelledby="feed-heading"><div className="feed-heading"><div><p className="eyebrow">THE PUBLIC GROUP CHAT</p><h2 id="feed-heading">The city has jokes.</h2></div><nav className="feed-tabs" aria-label="Sort captions">{[["new", "Fresh"], ["top", "Top rated"], ["today", "Today’s prompt"]].map(([key, label]) => <Link key={key} href={`/?sort=${key}#feed-heading`} aria-current={sort === key ? "page" : undefined}>{label}</Link>)}</nav></div>
      <div className="feed-note"><span>AI writes them. You decide what lands.</span><span>↑ Funny &nbsp; / &nbsp; ↓ Miss</span></div>
      {votesError && <p role="alert" className="form-status">Your saved votes couldn’t be loaded. Refresh before voting again.</p>}
      {error ? <div className="empty-state" role="alert"><span aria-hidden>↻</span><h3>The feed is taking a breather.</h3><p>We couldn’t load the captions. Please try again in a moment.</p><Link href="/" className="secondary-button">Try again</Link></div> : visible.length ? <div className="caption-grid">{visible.map((caption, i) => <CaptionCard key={caption.id} caption={caption} signedIn={!!user} myVote={myVotes.get(caption.id)} index={i}/>)}</div> : <div className="empty-state"><span aria-hidden>✳</span><h3>{sort === "today" ? "Today’s scene needs a punchline." : "Every good group chat starts somewhere."}</h3><p>Be the first to turn a little city chaos into a caption.</p><Link href={sort === "today" ? "/create?daily=1" : "/create"} className="secondary-button">Start the conversation ↗</Link></div>}
      <nav aria-label="Feed pages" className="pagination">{page > 0 && <Link href={`/?sort=${sort}&page=${page - 1}#feed-heading`}>← Previous</Link>}{captions.length > 12 && <Link href={`/?sort=${sort}&page=${page + 1}#feed-heading`}>More captions →</Link>}</nav>
      </section>
    </main><footer className="site-footer"><span>ONLY IN NEW YORK. <span className="footer-credit">A humor project by Anthony Qi</span></span><div><Link href="/jokes">The original jokes</Link><Link href="/privacy">Privacy</Link></div></footer>
  </div>;
}
