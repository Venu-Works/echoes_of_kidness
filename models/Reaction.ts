import mongoose, { Schema, Document, Types } from "mongoose";
import { REACTION_TYPES, ReactionType } from "@/types";

// One document per (story, person, reaction type). The unique index is what
// stops someone giving the same reaction twice.
export interface IReactionDoc extends Document {
  story_id: Types.ObjectId;
  // "user:<userId>" for signed-in users, "visitor:<uuid>" for anonymous ones
  reactor_key: string;
  type: ReactionType;
  created_at: Date;
}

const ReactionSchema = new Schema<IReactionDoc>({
  story_id: { type: Schema.Types.ObjectId, ref: "Story", required: true },
  reactor_key: { type: String, required: true },
  type: { type: String, enum: REACTION_TYPES, required: true },
  created_at: { type: Date, default: Date.now },
});

ReactionSchema.index({ story_id: 1, reactor_key: 1, type: 1 }, { unique: true });

export const Reaction =
  mongoose.models.Reaction ||
  mongoose.model<IReactionDoc>("Reaction", ReactionSchema);
