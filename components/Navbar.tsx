"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export function Navbar() {
  const { data: session, status } = useSession();
  const isAdmin = (session?.user as { isAdmin?: boolean } | undefined)?.isAdmin;

  return (
    <nav className="border-b bg-white sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-rose-600 tracking-tight">
          Heart Witness
        </Link>

        <div className="flex items-center gap-5 text-sm font-medium">
          <Link href="/stories" className="text-gray-600 hover:text-rose-600 transition-colors">
            Browse
          </Link>
          <Link
            href="/submit"
            className="bg-rose-600 text-white px-4 py-1.5 rounded-full hover:bg-rose-700 transition-colors"
          >
            Share a Story
          </Link>

          {status === "loading" ? null : session ? (
            <>
              <Link href="/profile" className="text-gray-600 hover:text-rose-600 transition-colors">
                My Stories
              </Link>
              {isAdmin && (
                <Link href="/admin" className="text-gray-600 hover:text-rose-600 transition-colors">
                  Review Queue
                </Link>
              )}
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="text-gray-500 hover:text-gray-800 transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link href="/login" className="text-gray-600 hover:text-rose-600 transition-colors">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
