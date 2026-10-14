import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dailyChallenge } from "@/lib/humor";
import { SiteHeader } from "@/components/site-header";
import { GenerationForm } from "./generation-form";

export const metadata = { title: "Caption studio | Only in New York" };
export const maxDuration = 60;
export default async function CreatePage({ searchParams }: { searchParams: Promise<{ daily?: string }> }) {
  const supabase = await createClient();
  const { daily } = await searchParams;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(daily === "1" ? "/create?daily=1" : "/create")}`);
  const challenge = dailyChallenge();
  return <div className="ny-app"><SiteHeader signedIn/><main className="studio-layout"><div className="studio-intro"><p className="eyebrow">THE CAPTION STUDIO</p><h1>Your life.<br/>AI’s punchline.</h1><p>Turn your everyday city chaos into something the group chat would actually laugh at.</p><aside className="studio-aside"><span>THE BRIEF</span><p>Specific beats generic.<br/>A little weird beats a little safe.<br/>Let the city do the setup.</p></aside></div><GenerationForm dailyScene={challenge.scene} initialScene={daily === "1" ? challenge.scene : ""}/></main></div>;
}
