import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { isProfileComplete, type Profile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Members | The Humor Project",
};

export default async function MembersPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_path")
    .eq("id", data.claims.sub)
    .maybeSingle<Profile>();

  if (!error && !isProfileComplete(profile)) redirect("/profile");

  return (
    <main className="min-h-screen bg-[#fffaf0] px-6 py-12 text-[#172135] sm:py-16">
      <div className="mx-auto max-w-4xl">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="text-sm font-bold underline underline-offset-4">← Home</Link>
          <div className="flex items-center gap-5 text-sm font-bold">
            <Link href="/profile" className="underline underline-offset-4">Profile</Link>
            <form action={signOut}><button className="underline underline-offset-4">Sign out</button></form>
          </div>
        </nav>
        <section className="mt-12 rounded-[2rem] border-4 border-[#172135] bg-white p-8 shadow-[10px_10px_0_#172135] sm:p-14">
          <p className="inline-block rotate-[-2deg] rounded-full border-2 border-[#172135] bg-[#06d6a0] px-4 py-2 text-xs font-black uppercase tracking-[0.15em]">
            The private corner
          </p>
          <h1 className="mt-8 text-5xl font-black tracking-[-0.06em] sm:text-7xl">
            Hey, {profile?.first_name ?? "friend"}!
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-[#485269]">
            You made it behind the curtain. This page is only shown after your sign-in is verified.
          </p>
          {error && <p role="alert" className="mt-5 text-[#9b2643]">Your profile could not be loaded right now.</p>}
          <div className="mt-9 flex flex-wrap gap-4">
            <Link href="/profile" className="rounded-xl border-2 border-[#172135] bg-[#ffd166] px-5 py-3 font-black shadow-[4px_4px_0_#172135]">Edit your profile →</Link>
            <Link href="/jokes" className="rounded-xl border-2 border-[#172135] bg-white px-5 py-3 font-black">Read the jokes</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
