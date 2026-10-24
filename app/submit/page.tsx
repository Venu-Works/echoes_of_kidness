import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SubmitForm } from "@/components/SubmitForm";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Share a Story",
  description: "Share your heartfelt story about kindness, gratitude, love, or respect.",
};

export default async function SubmitPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Share Your Story</h1>
        <p className="text-gray-600">
          Write a heartfelt story about kindness, gratitude, love, or respect — under 500 words.
          All stories are reviewed before publishing.
        </p>
      </div>

      {!session && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6 text-sm text-amber-800">
          You&apos;re submitting as a guest. To track your stories,{" "}
          <Link href="/login" className="font-medium underline">
            sign in or create an account
          </Link>
          .
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6 md:p-8">
        <SubmitForm userName={session?.user?.name} />
      </div>
    </div>
  );
}
