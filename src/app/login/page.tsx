import Link from "next/link";
import { redirect } from "next/navigation";
import { signInWithGoogle } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Sign in | The Humor Project",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect("/members");

  const { error } = await searchParams;

  return (
    <main className="min-h-screen bg-[#fffaf0] px-6 py-16 text-[#172135]">
      <div className="mx-auto max-w-lg">
        <Link href="/" className="text-sm font-bold underline underline-offset-4">
          ← Home
        </Link>
        <section className="mt-12 rounded-[2rem] border-4 border-[#172135] bg-white p-8 shadow-[10px_10px_0_#172135] sm:p-10">
          <p className="inline-block rounded-full border-2 border-[#172135] bg-[#ffd166] px-4 py-2 text-xs font-black uppercase tracking-[0.15em]">
            Members only
          </p>
          <h1 className="mt-7 text-5xl font-black tracking-[-0.06em]">Come on in.</h1>
          <p className="mt-4 text-lg leading-7 text-[#485269]">
            Sign in with Google to see the members page and make your profile your own.
          </p>
          {error && (
            <p role="alert" className="mt-6 rounded-xl bg-[#ffe3e8] p-4 font-semibold text-[#9b2643]">
              Sign in didn’t finish. Please try again.
            </p>
          )}
          <form action={signInWithGoogle} className="mt-8">
            <button className="w-full rounded-xl border-2 border-[#172135] bg-[#ffd166] px-5 py-4 text-lg font-black shadow-[4px_4px_0_#172135] transition-transform hover:-translate-y-1">
              Continue with Google →
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
