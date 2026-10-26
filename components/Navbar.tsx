"use client";

import Link from "next/link";
import { BrandMark } from "./BrandMark";
import { useSession, signOut } from "next-auth/react";

export function Navbar() {
  const { data: session, status } = useSession();
  const staffRole = (session?.user as { staffRole?: "admin" | "moderator" | null } | undefined)?.staffRole;

  return (
    <nav className="border-b bg-cream/95 backdrop-blur sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-5 py-4 flex flex-wrap gap-4 items-center justify-between">
        <Link href="/" className="flex items-center gap-3 text-ink tracking-tight" aria-label="Heart Witness home">
          <BrandMark className="h-11 w-11 shrink-0" />
          <span className="brand-name">Heart Witness<span className="brand-caption">SMALL MOMENTS. LASTING MEANING.</span></span>
        </Link>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm font-medium">
          <Link href="/stories" className="text-ink hover:text-terracotta-600 transition-colors">
            Browse
          </Link>
          <Link
            href="/submit"
            className="bg-terracotta-600 text-white px-4 py-1.5 rounded-full hover:bg-terracotta-700 transition-colors"
          >
            Share a story
          </Link>

          {status === "loading" ? null : session ? (
            <>
              <Link href="/profile" className="text-ink hover:text-terracotta-600 transition-colors">
                My stories
              </Link>
              {staffRole && (
                <Link href="/admin" className="text-ink hover:text-terracotta-600 transition-colors">
                  Review queue
                </Link>
              )}
              {staffRole === "admin" && (
                <Link href="/admin/team" className="text-ink hover:text-terracotta-600 transition-colors">
                  Team
                </Link>
              )}
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="text-muted hover:text-ink transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link href="/login" className="text-ink hover:text-terracotta-600 transition-colors">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
