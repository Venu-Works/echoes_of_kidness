export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";
import type { Metadata } from "next";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Story, IStoryDoc } from "@/models/Story";
import type { FlattenMaps, Types } from "mongoose";

type LeanStory = FlattenMaps<IStoryDoc> & { _id: Types.ObjectId };
import { EditForm } from "@/components/EditForm";

export const metadata: Metadata = { title: "Edit Story" };

export default async function EditStoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?callbackUrl=/profile");

  const { id } = await params;
  await connectDB();

  const userId = (session.user as { id: string }).id;
  let story;
  try {
    story = (await Story.findOne({ _id: id, user_id: userId }).lean()) as LeanStory | null;
  } catch {
    notFound();
  }

  if (!story) notFound();

  // Only rejected stories can be edited
  if (story.status !== "rejected") {
    redirect("/profile");
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <Link
        href="/profile"
        className="text-sm text-gray-500 hover:text-rose-600 transition-colors mb-8 inline-block"
      >
        ← Back to my stories
      </Link>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Edit & Resubmit</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          This story was not published. Edit it below and resubmit for review.
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 md:p-8">
        <EditForm
          storyId={id}
          initialTitle={story.title}
          initialBody={story.body}
          initialThemes={story.theme as string[]}
          initialDisplayName={story.display_name}
        />
      </div>
    </div>
  );
}
