import Link from "next/link";
export default function NotFound() { return <main className="empty-state"><h1>This punchline got away.</h1><p>We couldn’t find that page or caption.</p><Link href="/" className="primary-button">Back to the feed</Link></main>; }
