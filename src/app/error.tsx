"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="empty-state"><h1>A little city chaos.</h1><p>This page couldn’t load. Please try again.</p><button className="primary-button" onClick={reset}>Try again</button></main>;
}
