export const dynamic = "force-dynamic";

import Link from "next/link";
import { connectDB } from "@/lib/mongodb";
import { Story } from "@/models/Story";
import { StoryCard, reactionTotal } from "@/components/StoryCard";

async function getFeaturedStories() {
  await connectDB();
  return Story.find({ status: "approved" })
    .sort({ published_at: -1 })
    .limit(6)
    .select("-body")
    .lean();
}

export default async function HomePage() {
  const stories = await getFeaturedStories();

  return (
    <div>
      <section className="home-hero">
        <div className="hero-copy">
          <p className="eyebrow"><span /> A little space for the good in life</p>
          <h1>Some moments<br />deserve to be<br /><em>remembered.</em></h1>
          <p className="hero-description">Real people. Small acts. Lasting impact. A home for stories of love, respect, gratitude, and the kindness that connects us.</p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Link href="/stories" className="primary-link">Find a little inspiration <span aria-hidden="true">↗</span></Link>
            <Link href="/submit" className="secondary-link">Share your story <span aria-hidden="true">→</span></Link>
          </div>
          <p className="hero-note">A moment to read. A feeling to carry with you.</p>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
          <span className="art-spark spark-one">✳</span><span className="art-spark spark-two">✧</span>
          <div className="keepsake keepsake-back"><span>THE EVERYDAY MAGIC OF</span><strong>being there.</strong><div className="art-flower">✳</div></div>
          <div className="keepsake keepsake-front"><span>A NOTE TO REMEMBER</span><div className="drawn-heart">♡</div><strong>There is good<br />in the everyday.</strong><p>Sometimes, all it takes<br />is a story to see it.</p><div className="note-rule" /><small>HEART WITNESS</small></div>
          <div className="art-label">Little stories. Big feelings.</div>
        </div>
      </section>
      <div className="values-strip"><span>Every story starts with a little</span><Link href="/stories?theme=love">♡ Love</Link><Link href="/stories?theme=respect">✧ Respect</Link><Link href="/stories?theme=gratitude">☼ Gratitude</Link><Link href="/stories?theme=kindness">❋ Kindness</Link></div>

      {/* Featured stories */}
      <section className="max-w-6xl mx-auto px-5 py-16">
        <div className="flex items-center justify-between mb-6">
          <div><p className="eyebrow mb-2">FROM THE COMMUNITY</p><h2 className="section-heading">A little good, lately.</h2></div>
          <Link href="/stories" className="text-terracotta-600 text-sm font-medium hover:underline">
            View all →
          </Link>
        </div>

        {stories.length === 0 ? (
          <div className="empty-stories text-center py-16 text-muted">
            <p className="text-lg mb-2">Your story could be the beginning.</p>
            <p className="text-sm">A small act of kindness. A person you never forgot. Give that moment a home.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {stories.map((story) => {
              const id = String(story._id);
              return (
                <StoryCard
                  key={id}
                  story={{
                    _id: id,
                    title: story.title as string,
                    display_name: story.display_name as string,
                    theme: story.theme as string[],
                    word_count: story.word_count as number,
                    published_at: story.published_at as Date | null,
                    image_url: story.image_url as string | null,
                    read_count: story.read_count as number | undefined,
                    reaction_total: reactionTotal(story.reactions),
                  }}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="bg-terracotta-50 border-t border-terracotta-100 py-14 px-4">
        <div className="max-w-xl mx-auto text-center">
          <h3 className="text-xl font-bold text-ink mb-3">
            The ordinary moments are often the extraordinary ones.
          </h3>
          <p className="text-muted mb-6">
            Your story doesn&apos;t need to be perfect — just real.
          </p>
          <Link
            href="/submit"
            className="bg-terracotta-600 text-white px-8 py-3 rounded-full font-semibold hover:bg-terracotta-700 transition-colors"
          >
            Share my story →
          </Link>
        </div>
      </section>
    </div>
  );
}
