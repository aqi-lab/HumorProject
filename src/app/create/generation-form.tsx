"use client";
import { useActionState, useState } from "react";
import { generateCaption } from "./actions";
import { styles, type ActionState } from "@/lib/humor";

export function GenerationForm({ dailyScene, initialScene }: { dailyScene: string; initialScene: string }) {
  const [scene, setScene] = useState(initialScene);
  const [state, action, pending] = useActionState<ActionState, FormData>(generateCaption, {});
  return <form action={action} className="studio-form">
    <label htmlFor="scene">01 / Set the scene</label><p className="field-help">A campus moment. A subway story. A very expensive salad.</p>
    <textarea id="scene" name="scene" value={scene} onChange={e => setScene(e.target.value)} required minLength={12} maxLength={400} rows={5} placeholder="Describe your very New York moment…" disabled={pending}/>
    <div className="field-meta"><button type="button" className="text-button" onClick={() => setScene(dailyScene)} disabled={pending}>↳ Use today’s prompt</button><span>{scene.length}/400</span></div>
    <fieldset disabled={pending}><legend>02 / Pick the delivery</legend><div className="style-options">{styles.map((style, i) => <label key={style}><input type="radio" name="style" value={style} defaultChecked={i === 0}/><span>{style}</span></label>)}</div></fieldset>
    <p className="publish-note">Your scene and AI caption will appear in the public feed. Leave out personal details. Your full generation prompt stays private.</p>
    <button className="primary-button" disabled={pending || scene.trim().length < 12}>{pending ? "Writing your punchline…" : "Generate & publish ↗"}</button>
    <p className="field-help">10 attempts per day. One caption per attempt. Daily reset at midnight New York time.</p>
    <p role={state.error ? "alert" : "status"} className="form-status">{state.error || (pending ? "Finding the funny. This may take a few seconds." : "")}</p>
  </form>;
}
