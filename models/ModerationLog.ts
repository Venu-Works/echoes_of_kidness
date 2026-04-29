import mongoose, { Schema, Document, Types } from "mongoose";

export interface IModerationLogDoc extends Document {
  story_id: Types.ObjectId;
  safety_result: object;
  relevance_result: object;
  quality_result: object;
  final_verdict: "approved" | "rejected" | "human_review";
  processing_time_ms: number;
  reviewed_at: Date;
}

const ModerationLogSchema = new Schema<IModerationLogDoc>({
  story_id: {
    type: Schema.Types.ObjectId,
    ref: "Story",
    required: true,
    unique: true,
  },
  safety_result: { type: Schema.Types.Mixed },
  relevance_result: { type: Schema.Types.Mixed },
  quality_result: { type: Schema.Types.Mixed },
  final_verdict: {
    type: String,
    enum: ["approved", "rejected", "human_review"],
  },
  processing_time_ms: { type: Number },
  reviewed_at: { type: Date, default: Date.now },
});

export const ModerationLog =
  mongoose.models.ModerationLog ||
  mongoose.model<IModerationLogDoc>("ModerationLog", ModerationLogSchema);
