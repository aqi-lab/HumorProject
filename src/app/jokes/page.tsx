import Link from "next/link";
import { connection } from "next/server";
import { getJokes, type Joke } from "@/lib/jokes";

export const metadata = {
  title: "Jokes | The Humor Project",
  description: "A list of jokes loaded from Supabase.",
};

export default async function JokesPage() {
  await connection();

  let jokes: Joke[] = [];
  let error = false;
  try {
    jokes = await getJokes();
  } catch (cause) {
    console.error("Could not load jokes from Supabase:", cause);
    error = true;
  }

  return (
    <main className="min-h-screen bg-[#fffaf0] px-6 py-12 text-[#172135] sm:py-16">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="text-sm font-bold underline underline-offset-4">
          ← Back to Hello World
        </Link>

        <header className="mt-10">
          <p className="inline-flex rotate-[-2deg] rounded-full border-2 border-[#172135] bg-[#ffd166] px-4 py-2 text-sm font-bold uppercase tracking-[0.16em]">
            Designing for GenAI · Week 2
          </p>
          <h1 className="mt-8 text-5xl font-black tracking-[-0.06em] sm:text-7xl">
            Jokes from the database
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-[#485269]">
            These jokes are loaded from a Supabase table each time you visit this page.
          </p>
        </header>

        {error ? (
          <p role="alert" className="mt-10 rounded-2xl border-2 border-[#172135] bg-white p-6 font-semibold">
            The jokes could not be loaded right now. Please try again later.
          </p>
        ) : jokes.length === 0 ? (
          <p className="mt-10 rounded-2xl border-2 border-[#172135] bg-white p-6 font-semibold">
            No jokes have been added yet.
          </p>
        ) : (
          <ul className="mt-10 grid gap-5 sm:grid-cols-2">
            {jokes.map((joke, index) => (
              <li
                key={joke.id}
                className="rounded-[1.5rem] border-[3px] border-[#172135] bg-white p-6 shadow-[6px_6px_0_#172135]"
              >
                <p className="text-sm font-black uppercase tracking-[0.14em] text-[#ef476f]">
                  Joke {index + 1}
                </p>
                <h2 className="mt-4 text-2xl font-extrabold leading-tight">{joke.setup}</h2>
                <p className="mt-5 border-t-2 border-dashed border-[#c9d0db] pt-5 text-lg text-[#485269]">
                  {joke.punchline}
                </p>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-12 text-sm font-bold text-[#485269]">Built by Anthony Qi · Powered by Supabase</p>
      </div>
    </main>
  );
}
