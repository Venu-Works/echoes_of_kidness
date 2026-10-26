import mongoose, { Schema, Document, Types } from "mongoose";

export interface IModerationLogDoc extends Document {
  story_id: Types.ObjectId;
  safety_result: object;
  relevance_result: object;
  quality_result: object;
  final_verdict: "approved" | "rejected" | "human_review";
  // The orchestrator's plain-English reason, shown to admins
  verdict_reason?: string;
  // Set when an admin overrides or confirms the AI's decision
  admin_decision?: "approved" | "rejected";
  admin_decided_by?: string;
  admin_decided_at?: Date;
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
  verdict_reason: { type: String },
  admin_decision: { type: String, enum: ["approved", "rejected"] },
  admin_decided_by: { type: String },
  admin_decided_at: { type: Date },
  processing_time_ms: { type: Number },
  reviewed_at: { type: Date, default: Date.now },
});

export const ModerationLog =
  mongoose.models.ModerationLog ||
  mongoose.model<IModerationLogDoc>("ModerationLog", ModerationLogSchema);
