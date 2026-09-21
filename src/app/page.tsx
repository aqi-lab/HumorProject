import Link from "next/link";

export default function Home() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#fffaf0] px-6 py-12 text-[#172135]">
      <div className="absolute -left-20 top-[-5rem] h-72 w-72 rounded-full bg-[#ff6b6b] opacity-70 blur-3xl" />
      <div className="absolute -right-16 bottom-[-5rem] h-80 w-80 rounded-full bg-[#58d6c7] opacity-70 blur-3xl" />

      <section className="relative w-full max-w-3xl rounded-[2rem] border-4 border-[#172135] bg-white p-8 shadow-[10px_10px_0_#172135] sm:p-14">
        <p className="mb-8 inline-flex rotate-[-2deg] rounded-full border-2 border-[#172135] bg-[#ffd166] px-4 py-2 text-sm font-bold uppercase tracking-[0.16em]">
          Designing for GenAI · Week 1
        </p>

        <h1 className="text-balance text-6xl font-black leading-[0.92] tracking-[-0.06em] sm:text-8xl">
          Hello,
          <span className="block text-[#ef476f]">World!</span>
        </h1>

        <p className="mt-8 max-w-xl text-lg leading-8 text-[#485269] sm:text-xl">
          My first Next.js app is live. Small page, big beginning.
        </p>

        <p className="mt-6 inline-flex rounded-lg bg-[#172135] px-4 py-2 text-sm font-bold tracking-wide text-white">
          Built by Anthony Qi
        </p>

        <div className="mt-8">
          <Link
            href="/jokes"
            className="inline-flex rounded-xl border-2 border-[#172135] bg-[#ffd166] px-5 py-3 text-base font-black shadow-[4px_4px_0_#172135] transition-transform hover:-translate-y-1"
          >
            See Week 2 jokes →
          </Link>
        </div>

        <div className="mt-10 flex items-center gap-3 text-sm font-semibold text-[#485269]">
          <span className="h-3 w-3 animate-pulse rounded-full bg-[#06d6a0] ring-4 ring-[#06d6a0]/20" />
          Deployed with Vercel
        </div>
      </section>
    </main>
  );
}
