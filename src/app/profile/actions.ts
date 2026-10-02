"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/profile";

type SaveState = { error?: string; success?: string };

export async function saveProfile(
  _previous: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { error: "Your session ended. Please sign in again." };

  const firstName = formData.get("first_name");
  const lastName = formData.get("last_name");
  if (
    typeof firstName !== "string" ||
    typeof lastName !== "string" ||
    !firstName.trim() ||
    !lastName.trim() ||
    firstName.trim().length > 80 ||
    lastName.trim().length > 80
  ) {
    return { error: "Enter a first and last name, each under 80 characters." };
  }

  const userId = data.claims.sub;
  const { data: current, error: readError } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_path")
    .eq("id", userId)
    .maybeSingle<Profile>();
  if (readError) return { error: "Your profile could not be loaded. Please try again." };

  let avatarPath = current?.avatar_path ?? null;
  let uploadedPath: string | null = null;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const extensions: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    const extension = extensions[photo.type];
    if (!extension || photo.size > 3 * 1024 * 1024) {
      return { error: "Choose a JPG, PNG, or WebP photo under 3 MB." };
    }

    uploadedPath = `${userId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(uploadedPath, photo, { contentType: photo.type, upsert: false });
    if (uploadError) return { error: "The photo could not be uploaded. Please try again." };
    avatarPath = uploadedPath;
  }

  const { error: saveError } = await supabase.from("profiles").upsert({
    id: userId,
    first_name: firstName.trim(),
    last_name: lastName.trim(),
    avatar_path: avatarPath,
  });

  if (saveError) {
    if (uploadedPath) await supabase.storage.from("avatars").remove([uploadedPath]);
    return { error: "Your changes could not be saved. Please try again." };
  }

  if (uploadedPath && current?.avatar_path) {
    await supabase.storage.from("avatars").remove([current.avatar_path]);
  }

  revalidatePath("/profile");
  revalidatePath("/members");
  return { success: "Profile saved." };
}
