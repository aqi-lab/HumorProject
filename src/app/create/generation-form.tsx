"use client";
import Link from "next/link";
import Image from "next/image";
import { useActionState, useEffect, useState } from "react";
import { generateCaption } from "./actions";
import { MAX_PHOTO_BYTES } from "@/lib/caption-input";
import type { ActionState } from "@/lib/humor";

export function GenerationForm({ dailyScene, initialScene, initialDirection, initialPhotoUrl, sourceId }: { dailyScene: string; initialScene: string; initialDirection: string; initialPhotoUrl?: string; sourceId?: string }) {
  const [mode, setMode] = useState(initialPhotoUrl ? "photo" : "scene");
  const [scene, setScene] = useState(initialScene);
  const [direction, setDirection] = useState(initialDirection);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | undefined>();
  const [fileError, setFileError] = useState("");
  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);
  const [state, action, pending] = useActionState<ActionState, FormData>(async (previous, data) => {
    // Keep a selected file available if a provider error resets the native form input.
    if (mode === "photo" && file) data.set("photo", file);
    return generateCaption(previous, data);
  }, {});
  const photoUrl = file ? preview : initialPhotoUrl;
  const canSubmit = direction.trim().length >= 3 && (mode === "photo" ? !!(file || initialPhotoUrl) && !fileError : scene.trim().length >= 12);
  return <form action={action} className="studio-form" aria-busy={pending}>
    {sourceId && <p className="reuse-note">This is your editable copy. Changes won’t affect the original.</p>}
    <fieldset disabled={pending} className="input-choice"><legend>1 / Start with an image</legend><div className="input-tabs"><button type="button" aria-pressed={mode === "scene"} onClick={() => setMode("scene")}>Describe an image</button><button type="button" aria-pressed={mode === "photo"} onClick={() => setMode("photo")}>Upload a photo</button></div></fieldset>
    <input type="hidden" name="input_mode" value={mode}/>
    {mode === "photo" && <div className="photo-upload">
      <label htmlFor="photo">Choose your photo</label><p id="photo-help" className="field-help">JPG, PNG, or WebP. Maximum 3 MB. The photo will be public with your caption.</p>
      <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={pending} aria-describedby="photo-help" onChange={event => {
        const selected = event.target.files?.[0];
        if (!selected) return;
        if (selected.size > MAX_PHOTO_BYTES || !["image/jpeg", "image/png", "image/webp"].includes(selected.type)) { setFileError("Choose a JPG, PNG, or WebP under 3 MB."); event.target.value = ""; return; }
        setFileError(""); setFile(selected); setPreview(URL.createObjectURL(selected));
      }}/>
      {photoUrl && <div className="photo-preview"><Image src={photoUrl} alt="The photo the AI will caption" width={1280} height={960} unoptimized/><p>{file ? file.name : "Photo copied from the source. Choose a file above to replace it."}</p></div>}
      {fileError && <p role="alert" className="form-status">{fileError}</p>}
    </div>}
    <label htmlFor="scene">{mode === "photo" ? "Add context (optional)" : "Describe what’s in the image"}</label>
    <p id="scene-help" className="field-help">{mode === "photo" ? "Tell the AI anything the photo doesn’t explain. It will also look at the photo." : "What would we see? Be specific about the moment, objects, or setting."}</p>
    <textarea id="scene" name="scene" value={scene} onChange={event => setScene(event.target.value)} required={mode === "scene"} minLength={mode === "scene" ? 12 : undefined} maxLength={400} rows={mode === "photo" ? 3 : 4} placeholder={mode === "photo" ? "For example: This was supposed to be a quick coffee break…" : "A pigeon guarding the last empty bench outside the library…"} disabled={pending} aria-describedby="scene-help"/>
    <div className="field-meta"><button type="button" className="text-button" disabled={pending} onClick={() => { setMode("scene"); setScene(dailyScene); }}>Use today’s idea</button><span>{scene.length}/400</span></div>
    <label htmlFor="direction" className="direction-label">2 / What should the caption be like?</label>
    <p id="direction-help" className="field-help">Give the topic, tone, or joke you have in mind. The AI will use this with your image.</p>
    <textarea id="direction" name="direction" value={direction} onChange={event => setDirection(event.target.value)} required minLength={3} maxLength={300} rows={3} placeholder="Make it a dry joke about how the pigeon looks like it owns the place." disabled={pending} aria-describedby="direction-help"/>
    <div className="field-meta"><span>You direct it. AI writes it.</span><span>{direction.length}/300</span></div>
    {sourceId && <input type="hidden" name="source_id" value={sourceId}/>}
    <p className="publish-note">Your photo, image description, caption instructions, and AI caption will appear in the public feed. Leave out personal details and only upload photos you can share.</p>
    <button className="primary-button" disabled={pending || !canSubmit}>{pending ? "Writing your caption…" : "3 / Generate & publish ↗"}</button>
    <p className="field-help">10 attempts per day, resetting at midnight New York time. Backup AIs are tried automatically within the same attempt.</p>
    <p role={state.error ? "alert" : "status"} className="form-status">{state.error || (pending ? "Looking for the punchline. If an AI is busy, we’ll try a backup. This can take up to 45 seconds." : "")}</p>
    {sourceId && <Link href="/create" className="start-over">Start with a new idea instead ↗</Link>}
  </form>;
}
