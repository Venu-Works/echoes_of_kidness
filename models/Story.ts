import mongoose, { Schema, Document, Types } from "mongoose";

export interface IStoryDoc extends Document {
  user_id: Types.ObjectId | null;
  display_name: string;
  title: string;
  body: string;
  theme: ("love" | "respect" | "gratitude" | "kindness")[];
  word_count: number;
  status: "pending" | "approved" | "rejected" | "human_review";
  submitted_at: Date;
  published_at: Date | null;
  image_url: string | null;
  image_status: "none" | "pending" | "ready" | "failed";
  read_count: number;
  reactions: {
    gratitude: number;
    respect: number;
    love: number;
    applause: number;
  };
}

const StorySchema = new Schema<IStoryDoc>({
  user_id: { type: Schema.Types.ObjectId, ref: "User", default: null },
  display_name: { type: String, required: true },
  title: { type: String, required: true, maxlength: 200 },
  body: { type: String, required: true },
  theme: [{ type: String, enum: ["love", "respect", "gratitude", "kindness"] }],
  word_count: { type: Number, required: true },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected", "human_review"],
    default: "pending",
  },
  submitted_at: { type: Date, default: Date.now },
  published_at: { type: Date, default: null },
  image_url: { type: String, default: null },
  image_status: {
    type: String,
    enum: ["none", "pending", "ready", "failed"],
    default: "none",
  },
  // Denormalised counters, kept in step with the Reaction collection
  read_count: { type: Number, default: 0 },
  reactions: {
    gratitude: { type: Number, default: 0 },
    respect: { type: Number, default: 0 },
    love: { type: Number, default: 0 },
    applause: { type: Number, default: 0 },
  },
});

StorySchema.index({ status: 1, published_at: -1 });
StorySchema.index({ user_id: 1, submitted_at: -1 });

export const Story =
  mongoose.models.Story || mongoose.model<IStoryDoc>("Story", StorySchema);
