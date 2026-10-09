import Link from "next/link";
import { signOut } from "@/app/auth/actions";

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return <header className="site-header">
    <Link href="/" className="wordmark" aria-label="Only in New York home"><span className="brand-icon">NY</span> ONLY IN NEW YORK<span className="brand-period">.</span></Link>
    <nav aria-label="Main navigation"><Link href="/">The feed</Link><Link href="/create" className="nav-create">Make a caption <span aria-hidden>↗</span></Link>{signedIn ? <><Link href="/profile">Profile</Link><form action={signOut}><button className="text-button">Sign out</button></form></> : <Link href="/login" className="sign-in">Sign in <span aria-hidden>↗</span></Link>}</nav>
  </header>;
}
