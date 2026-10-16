"use client";
import { useActionState } from "react";
import { generateMissingImage } from "./image-actions";
import type { ActionState } from "@/lib/humor";

export function GenerateImageForm({ captionId }: { captionId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(generateMissingImage, {});
  return <form action={action} className="missing-image-form" aria-busy={pending}>
    <p>This older post has a caption but no image. Generate its image from your original description.</p>
    <input type="hidden" name="caption_id" value={captionId}/>
    <button className="primary-button" disabled={pending}>{pending ? "Creating the missing image…" : "Generate missing image ↗"}</button>
    <p role={state.error ? "alert" : "status"}>{state.error || state.success || (pending ? "This can take up to a minute. Your caption and votes will be kept." : "")}</p>
  </form>;
}
