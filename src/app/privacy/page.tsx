import Link from "next/link";

export const metadata = {
  title: "Privacy | The Humor Project",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#fffaf0] px-6 py-12 text-[#172135] sm:py-16">
      <article className="mx-auto max-w-3xl rounded-[2rem] border-4 border-[#172135] bg-white p-8 shadow-[10px_10px_0_#172135] sm:p-12">
        <Link href="/" className="text-sm font-bold underline underline-offset-4">
          ← Home
        </Link>
        <h1 className="mt-8 text-5xl font-black tracking-[-0.06em]">Privacy</h1>
        <p className="mt-6 leading-7 text-[#485269]">
          The Humor Project uses Google sign-in through Supabase to identify your
          account. This provides your email address and basic Google profile
          information to the sign-in service.
        </p>
        <h2 className="mt-8 text-2xl font-black">Your profile</h2>
        <p className="mt-3 leading-7 text-[#485269]">
          We store the first and last name you enter, plus an optional photo.
          Profile details are stored in Supabase. Photos are stored in a private
          Supabase Storage bucket; the database stores only a reference to the
          photo. We use this information to show your profile and personalize
          the members page.
        </p>
        <h2 className="mt-8 text-2xl font-black">Captions and votes</h2>
        <p className="mt-3 leading-7 text-[#485269]">
          When you generate a caption, your photo or image description and caption
          instructions are sent to an AI provider. The app uses Google Gemini and
          may automatically try configured backups such as Groq, OpenRouter, or
          Vercel AI Gateway if a provider is busy or unavailable. Your photo,
          image description, caption instructions, and generated caption are published in
          the public feed. Photo metadata is removed before processing. Caption photos
          are stored in Supabase and made viewable through expiring links on public
          caption pages. Please do not include private information. We save the
          exact prompts, model name, and your account ID in a private generation
          record. Generation attempts are recorded to enforce a daily limit.
          Votes are associated with your account; other visitors see only the
          aggregate score and vote count, never individual voting records.
        </p>
        <h2 className="mt-8 text-2xl font-black">Your choices</h2>
        <p className="mt-3 leading-7 text-[#485269]">
          You can change your name and photo in the Profile section. To ask
          about your data or request account deletion, email the app support
          contact at aq2268@columbia.edu. You can also revoke Google sign-in
          access in your Google Account settings.
        </p>
        <h2 className="mt-8 text-2xl font-black">Service providers</h2>
        <p className="mt-3 leading-7 text-[#485269]">
          Google handles sign-in, Supabase handles authentication and profile
          storage, and Vercel hosts the website. We do not use your profile
          information for advertising or sell it.
        </p>
      </article>
    </main>
  );
}
