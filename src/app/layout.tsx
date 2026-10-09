import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Only in New York | The Humor Project",
  description: "Campus lore, city chaos, and AI-generated captions. Make a punchline and vote on what lands.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
