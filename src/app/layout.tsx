import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hello World | The Humor Project",
  description: "A tiny hello from Anthony's first Next.js app.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
