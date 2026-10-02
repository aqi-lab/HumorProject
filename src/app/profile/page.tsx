import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { isProfileComplete, type Profile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export const metadata = {
  title: "Profile | The Humor Project",
};

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_path")
    .eq("id", data.claims.sub)
    .maybeSingle<Profile>();

  let avatarUrl: string | null = null;
  if (profile?.avatar_path) {
    const { data: signed } = await supabase.storage
      .from("avatars")
      .createSignedUrl(profile.avatar_path, 60 * 60);
    avatarUrl = signed?.signedUrl ?? null;
  }

  const complete = isProfileComplete(profile);

  return (
    <main className="min-h-screen bg-[#fffaf0] px-6 py-12 text-[#172135] sm:py-16">
      <div className="mx-auto max-w-3xl">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/members" className="text-sm font-bold underline underline-offset-4">← Members</Link>
          <form action={signOut}><button className="text-sm font-bold underline underline-offset-4">Sign out</button></form>
        </nav>
        <section className="mt-10 rounded-[2rem] border-4 border-[#172135] bg-white p-8 shadow-[10px_10px_0_#172135] sm:p-12">
          <div className="flex flex-wrap items-center gap-6">
            {avatarUrl ? (
              // Signed URLs from the private bucket expire after one hour.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Your profile photo" className="h-24 w-24 rounded-full border-4 border-[#172135] object-cover" />
            ) : (
              <div aria-hidden="true" className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-[#172135] bg-[#58d6c7] text-4xl">☺</div>
            )}
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ef476f]">Your profile</p>
              <h1 className="mt-2 text-5xl font-black tracking-[-0.06em]">Make it yours.</h1>
            </div>
          </div>
          {!complete && !error && (
            <p className="mt-8 rounded-xl border-2 border-[#172135] bg-[#fff0c7] p-4 font-semibold">
              One quick thing before you enter the members page: add your first and last name.
            </p>
          )}
          {error ? (
            <p role="alert" className="mt-8 rounded-xl bg-[#ffe3e8] p-4 font-semibold text-[#9b2643]">
              Your profile could not be loaded. Check that the Week 3 SQL has been applied.
            </p>
          ) : (
            <ProfileForm profile={profile} />
          )}
          {complete && <Link href="/members" className="mt-8 inline-block text-sm font-bold underline underline-offset-4">Go to the members page →</Link>}
        </section>
      </div>
    </main>
  );
}
