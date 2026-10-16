import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dailyChallenge, uuidPattern } from "@/lib/humor";
import { SiteHeader } from "@/components/site-header";
import { GenerationForm } from "./generation-form";

export const metadata = { title: "Caption studio | Only in New York" };
export const maxDuration = 60;
export default async function CreatePage({ searchParams }: { searchParams: Promise<{ daily?: string; remix?: string }> }) {
  const supabase = await createClient();
  const { daily, remix } = await searchParams;
  const remixId = typeof remix === "string" && uuidPattern.test(remix) ? remix : null;
  if (remix && !remixId) notFound();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(remixId ? `/create?remix=${remixId}` : daily === "1" ? "/create?daily=1" : "/create")}`);
  const challenge = dailyChallenge();
  const { data: original, error } = remixId
    ? await supabase.from("captions").select("scene,caption").eq("id", remixId).maybeSingle()
    : { data: null, error: null };
  if (remixId && !error && !original) notFound();
  if (error) return <div className="ny-app"><SiteHeader signedIn/><main className="caption-detail"><div className="empty-state" role="alert"><h1>The original caption couldn’t load.</h1><p>Try again in a moment, or choose another scene from the feed.</p><Link href={`/create?remix=${remixId}`} className="secondary-button">Try again</Link> <Link href="/" className="secondary-button">Browse captions</Link></div></main></div>;
  return <div className="ny-app"><SiteHeader signedIn/><main className="studio-layout"><div className="studio-intro"><p className="eyebrow">THE CAPTION STUDIO</p><h1>{remixId ? <>Same scene.<br/>Your punchline.</> : <>Your life.<br/>AI’s punchline.</>}</h1><p>{remixId ? "Use this scene to create a different AI punchline. After it’s published, compare both captions and vote for what lands." : "Turn your everyday city chaos into something the group chat would actually laugh at."}</p>{remixId && original ? <aside className="remix-original"><span>THE ORIGINAL CAPTION</span><p>“{original.caption}”</p><Link href={`/caption/${remixId}`}>View original ↗</Link></aside> : <aside className="studio-aside"><span>THE BRIEF</span><p>Specific beats generic.<br/>A little weird beats a little safe.<br/>Let the city do the setup.</p></aside>}</div><GenerationForm key={remixId || daily || "new"} dailyScene={challenge.scene} initialScene={original?.scene || (daily === "1" ? challenge.scene : "")} remixId={remixId}/></main></div>;
}
