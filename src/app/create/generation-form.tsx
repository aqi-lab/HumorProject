"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { generateCaption } from "./actions";
import { type ActionState } from "@/lib/humor";

export function GenerationForm({ dailyScene, initialScene, remixId }: { dailyScene: string; initialScene: string; remixId: string | null }) {
  const [scene, setScene] = useState(initialScene);
  const [state, action, pending] = useActionState<ActionState, FormData>(generateCaption, {});
  return <form action={action} className="studio-form">
    <label htmlFor="scene">{remixId ? "The scene you’re remixing" : "Set the scene"}</label><p className="field-help">{remixId ? "This is copied from the original caption. Your remix will use the same scene and a new punchline." : "What happened? A campus moment, a subway story, a very expensive salad…"}</p>
    <textarea id="scene" name="scene" value={scene} onChange={e => setScene(e.target.value)} readOnly={!!remixId} required minLength={12} maxLength={400} rows={5} placeholder="Describe your very New York moment…" disabled={pending}/>
    <div className="field-meta">{remixId ? <Link href="/create" className="text-button">Write a different scene instead ↗</Link> : <button type="button" className="text-button" onClick={() => setScene(dailyScene)} disabled={pending}>↳ Use today’s prompt</button>}<span>{scene.length}/400</span></div>
    <input type="hidden" name="style" value="Deadpan" />
    {remixId && <input type="hidden" name="remix_id" value={remixId} />}
    <p className="publish-note">Your scene and AI caption will appear in the public feed. Leave out personal details. Your full generation prompt stays private.</p>
    <button className="primary-button" disabled={pending || scene.trim().length < 12}>{pending ? "Writing your punchline…" : remixId ? "Generate my remix ↗" : "Generate & publish ↗"}</button>
    <p className="field-help">10 attempts per day. One caption per attempt. Daily reset at midnight New York time.</p>
    <p role={state.error ? "alert" : "status"} className="form-status">{state.error || (pending ? "Finding the funny. This may take a few seconds." : "")}</p>
  </form>;
}
