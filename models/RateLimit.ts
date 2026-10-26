import mongoose, { Schema, Document } from "mongoose";

// Submission rate-limit counters, used when QUEUE_BACKEND=mongo
export interface IRateLimitDoc extends Omit<Document, "_id"> {
  _id: string; // hashed limit key
  count: number;
  expires_at: Date;
}

const RateLimitSchema = new Schema<IRateLimitDoc>({
  _id: { type: String, required: true },
  count: { type: Number, default: 0 },
  expires_at: { type: Date, required: true },
});

// MongoDB removes expired counters (its TTL sweep runs about once a minute,
// so lib/rateLimit.ts also treats expired-but-not-yet-removed ones as gone)
RateLimitSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export const RateLimit =
  mongoose.models.RateLimit ||
  mongoose.model<IRateLimitDoc>("RateLimit", RateLimitSchema, "rate_limits");
