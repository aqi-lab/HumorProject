"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { uuidPattern, type ActionState } from "@/lib/humor";

export async function vote(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { error: "Please sign in to vote." };
  const captionId = formData.get("caption_id");
  const value = formData.get("value");
  if (typeof captionId !== "string" || !uuidPattern.test(captionId) || (value !== "1" && value !== "-1")) {
    return { error: "Choose Funny or Miss on a valid caption." };
  }
  const { error } = await supabase.from("caption_votes").upsert({
    caption_id: captionId, user_id: user.id, value: Number(value),
  }, { onConflict: "caption_id,user_id" });
  if (error) return { error: "Your vote couldn’t be saved. Please try again." };
  revalidatePath("/");
  revalidatePath("/collection");
  revalidatePath(`/caption/${captionId}`);
  return { success: value === "1" ? "Voted funny. You can change your vote." : "Voted miss. You can change your vote." };
}
