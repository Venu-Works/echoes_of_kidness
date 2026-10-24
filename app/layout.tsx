import type { Metadata } from "next";
import { DM_Sans, Lora } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { Navbar } from "@/components/Navbar";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { getSiteUrl } from "@/lib/site";

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const serif = Lora({ subsets: ["latin"], variable: "--font-serif", style: ["normal", "italic"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: "Heart Witness — Some moments deserve to be remembered",
    template: "%s | Heart Witness",
  },
  description:
    "A home for real stories of kindness, gratitude, love, and respect — shared by the people who experienced them.",
  openGraph: {
    siteName: "Heart Witness",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${serif.variable} font-sans`}>
        <SessionProvider>
          <Navbar />
          <main className="min-h-screen">{children}</main>
          <footer className="border-t border-sand px-5 py-8">
            <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-6">
              <Link href="/" className="flex items-center gap-3 font-medium">
                <BrandMark className="w-8 h-8" />
                <span className="font-serif text-lg">Heart Witness</span>
              </Link>
              <p className="text-xs text-muted">A home for the moments that make us human.</p>
              <Link href="/submit" className="text-xs text-terracotta-700 hover:underline">Add your voice →</Link>
            </div>
          </footer>
        </SessionProvider>
      </body>
    </html>
  );
}
