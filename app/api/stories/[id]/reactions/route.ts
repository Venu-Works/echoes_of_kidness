import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { Story } from "@/models/Story";
import { Reaction } from "@/models/Reaction";
import { getReactorKey } from "@/lib/reactor";
import { REACTION_TYPES, ReactionCounts, ReactionType } from "@/types";

const ToggleSchema = z.object({ type: z.enum(REACTION_TYPES) });

function toCounts(reactions?: Partial<ReactionCounts>): ReactionCounts {
  return {
    gratitude: reactions?.gratitude ?? 0,
    respect: reactions?.respect ?? 0,
    love: reactions?.love ?? 0,
    applause: reactions?.applause ?? 0,
  };
}

// Toggles one reaction for the current person: adds it if they haven't given
// it yet, removes it if they have. Returns the updated counts and the
// reactions this person has given.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = ToggleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid reaction" }, { status: 400 });
  }
  const type: ReactionType = parsed.data.type;

  await connectDB();

  try {
    if (!(await Story.exists({ _id: id, status: "approved" }))) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid story ID" }, { status: 400 });
  }

  const reactorKey = (await getReactorKey(true))!;
  const filter = { story_id: id, reactor_key: reactorKey, type };

  const removed = await Reaction.deleteOne(filter);
  if (removed.deletedCount === 1) {
    await Story.updateOne(
      { _id: id, [`reactions.${type}`]: { $gt: 0 } },
      { $inc: { [`reactions.${type}`]: -1 } }
    );
  } else {
    try {
      await Reaction.create(filter);
      await Story.updateOne({ _id: id }, { $inc: { [`reactions.${type}`]: 1 } });
    } catch (err) {
      // Duplicate key = a simultaneous double-tap already added it; ignore
      if ((err as { code?: number }).code !== 11000) throw err;
    }
  }

  const [story, mine] = await Promise.all([
    Story.findById(id, { reactions: 1 }).lean<{ reactions?: Partial<ReactionCounts> }>(),
    Reaction.find({ story_id: id, reactor_key: reactorKey }, { type: 1 }).lean<{ type: ReactionType }[]>(),
  ]);

  return NextResponse.json({
    counts: toCounts(story?.reactions),
    mine: mine.map((r) => r.type),
  });
}
