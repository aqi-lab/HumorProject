"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { vote } from "@/app/actions";
import type { Caption, ActionState } from "@/lib/humor";

export function CaptionCard({ caption, signedIn, myVote = 0, index = 0 }: { caption: Caption; signedIn: boolean; myVote?: number; index?: number }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(vote, {});
  const [copied, setCopied] = useState("");
  async function share() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/caption/${caption.id}`);
      setCopied("Link copied!");
    } catch { setCopied("Open the caption and copy its address to share."); }
  }
  return <article className={`caption-card card-color-${index % 3}`}>
    <div className="caption-paper"><div className="card-kicker"><span>{caption.challenge_date ? "DAILY CHALLENGE" : "CITY OBSERVATIONS"}</span><span>AI GENERATED ✳</span></div><p className="scene-label">THE SCENE</p><p className="card-scene">{caption.scene}</p><Link href={`/caption/${caption.id}`} className="caption-link"><h2>“{caption.caption}”</h2></Link></div>
    <div className="card-bottom"><p className="score"><strong>{caption.score > 0 ? "+" : ""}{caption.score}</strong> score <span>· {caption.vote_count} {caption.vote_count === 1 ? "vote" : "votes"}</span></p>
      {signedIn ? <form action={action} className="vote-controls"><input type="hidden" name="caption_id" value={caption.id}/><button disabled={pending} name="value" value="1" aria-pressed={myVote === 1} className={myVote === 1 ? "selected" : ""}>↑ Funny</button><button disabled={pending} name="value" value="-1" aria-pressed={myVote === -1} className={myVote === -1 ? "selected" : ""}>↓ Miss</button></form> : <Link href={`/login?next=${encodeURIComponent(`/caption/${caption.id}`)}`} className="vote-signin">Sign in to vote ↗</Link>}
      <button type="button" onClick={share} className="share-button" aria-label="Copy caption link">Share ↗</button>
    </div><div aria-live="polite" className="card-status">{pending ? "Saving vote…" : state.error || state.success || copied}</div>
  </article>;
}
