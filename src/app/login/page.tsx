import Link from "next/link";
import { redirect } from "next/navigation";
import { signInWithGoogle } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { signInDestination } from "@/lib/navigation";
import { SiteHeader } from "@/components/site-header";

export const metadata = {
  title: "Sign in | The Humor Project",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const { error, next } = await searchParams;
  const destination = signInDestination(next || "/collection");
  if (data?.claims) redirect(destination);

  return (
    <div className="ny-app"><SiteHeader signedIn={false}/><main className="login-main">
      <section className="login-card">
          <p className="eyebrow">YOUR SEAT IN THE GROUP CHAT</p>
          <h1>Come on in<span className="brand-period">.</span></h1>
          <p>Sign in with Google to make captions, vote on what lands, and keep the best ones in your collection.</p>
          {error && (
            <p role="alert" className="form-status">
              Sign in didn’t finish. Please try again.
            </p>
          )}
          <form action={signInWithGoogle}>
            <input type="hidden" name="next" value={destination} />
            <button className="primary-button">
              Continue with Google →
            </button>
          </form>
          <Link href="/" className="back-link">← Browse the public feed</Link>
      </section>
    </main></div>
  );
}
