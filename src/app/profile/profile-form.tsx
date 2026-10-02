"use client";

import { useActionState } from "react";
import { saveProfile } from "./actions";
import type { Profile } from "@/lib/profile";

export function ProfileForm({ profile }: { profile: Profile | null }) {
  const [state, action, pending] = useActionState(saveProfile, {});

  return (
    <form action={action} className="mt-8 space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-black">
          First name
          <input
            name="first_name"
            required
            maxLength={80}
            defaultValue={profile?.first_name ?? ""}
            autoComplete="given-name"
            className="mt-2 block w-full rounded-xl border-2 border-[#172135] bg-white px-4 py-3 text-base font-medium outline-offset-4"
          />
        </label>
        <label className="block text-sm font-black">
          Last name
          <input
            name="last_name"
            required
            maxLength={80}
            defaultValue={profile?.last_name ?? ""}
            autoComplete="family-name"
            className="mt-2 block w-full rounded-xl border-2 border-[#172135] bg-white px-4 py-3 text-base font-medium outline-offset-4"
          />
        </label>
      </div>
      <label className="block text-sm font-black">
        Your photo <span className="font-medium text-[#485269]">(optional)</span>
        <input
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="mt-2 block w-full rounded-xl border-2 border-dashed border-[#172135] bg-[#fffaf0] p-4 text-sm font-medium file:mr-4 file:rounded-lg file:border-0 file:bg-[#ffd166] file:px-4 file:py-2 file:font-black"
        />
        <span className="mt-2 block font-medium text-[#485269]">JPG, PNG, or WebP, up to 3 MB.</span>
      </label>
      {state.error && <p role="alert" className="rounded-xl bg-[#ffe3e8] p-4 font-semibold text-[#9b2643]">{state.error}</p>}
      {state.success && <p role="status" className="rounded-xl bg-[#d9f8ef] p-4 font-semibold text-[#155f4e]">{state.success}</p>}
      <button
        disabled={pending}
        className="rounded-xl border-2 border-[#172135] bg-[#ffd166] px-6 py-3 font-black shadow-[4px_4px_0_#172135] transition-transform hover:-translate-y-1 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save profile →"}
      </button>
    </form>
  );
}
