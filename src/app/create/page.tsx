import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dailyChallenge, uuidPattern, type Caption } from "@/lib/humor";
import { withCaptionMedia } from "@/lib/caption-media";
import { reusePromptEnabled, reusePromptPath } from "@/features/reuse-prompt";
import { SiteHeader } from "@/components/site-header";
import { GenerationForm } from "./generation-form";

export const metadata = { title: "Caption studio | Only in New York" };
export const maxDuration = 60;
export default async function CreatePage({ searchParams }: { searchParams: Promise<{ daily?: string; remix?: string }> }) {
  const { daily, remix } = await searchParams;
  if (remix && !reusePromptEnabled) redirect("/create");
  const sourceId = typeof remix === "string" && uuidPattern.test(remix) ? remix : undefined;
  if (remix && !sourceId) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(sourceId ? reusePromptPath(sourceId) : daily === "1" ? "/create?daily=1" : "/create")}`);
  const challenge = dailyChallenge();
  let source: Caption | undefined;
  if (sourceId) {
    const { data, error } = await supabase.rpc("caption_feed", { p_id: sourceId });
    if (error) throw new Error("The source caption could not be loaded. Please try again.");
    const [caption] = (data || []) as Caption[];
    if (!caption) notFound();
    [source] = await withCaptionMedia([caption]);
  }
  return <div className="ny-app"><SiteHeader signedIn/><main className="studio-layout">
    <div className="studio-intro"><p className="eyebrow">THE CAPTION STUDIO</p><h1>{source ? <>Their idea.<br/>Your take.</> : <>Your image.<br/>AI’s punchline.</>}</h1>
      <p>{source ? "We copied the public image description and caption instructions. Edit them below, then generate your own caption." : "Upload a photo or describe an image. Tell the AI what you want the caption to say, then let it write the punchline."}</p>
      <ol className="studio-steps"><li><span>1</span>Upload a photo or describe an image.</li><li><span>2</span>Tell the AI what kind of caption you want.</li><li><span>3</span>Generate, share, and see how people vote.</li></ol>
      {source && <Link href={`/caption/${source.id}`} className="back-link">View the source caption ↗</Link>}
    </div>
    <GenerationForm key={sourceId || daily || "new"} dailyScene={challenge.scene} initialScene={source ? source.input_scene ?? source.scene : daily === "1" ? challenge.scene : ""} initialDirection={source?.caption_instructions || ""} initialPhotoUrl={source?.photo_url} sourceId={sourceId}/>
  </main></div>;
}
