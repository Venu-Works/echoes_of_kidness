import mongoose, { Schema, Document } from "mongoose";

// A background job, used when QUEUE_BACKEND=mongo (see lib/queue/mongoQueue.ts)
export interface IQueueJobDoc extends Document {
  queue: "moderation" | "illustration";
  // Caller-chosen ID; the unique index makes adding the same ID twice a no-op
  job_id: string;
  data: Record<string, unknown>;
  status: "waiting" | "active" | "completed" | "failed";
  attempts_made: number;
  max_attempts: number;
  backoff_ms: number;
  run_at: Date;
  // While active: the job is reclaimed if its worker dies and this passes
  locked_until: Date | null;
  locked_by: string | null;
  last_error: string | null;
  // Kept finished jobs are deleted automatically after this time
  expire_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

const QueueJobSchema = new Schema<IQueueJobDoc>(
  {
    queue: { type: String, enum: ["moderation", "illustration"], required: true },
    job_id: { type: String, required: true },
    data: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ["waiting", "active", "completed", "failed"],
      default: "waiting",
    },
    attempts_made: { type: Number, default: 0 },
    max_attempts: { type: Number, required: true },
    backoff_ms: { type: Number, required: true },
    run_at: { type: Date, default: Date.now },
    locked_until: { type: Date, default: null },
    locked_by: { type: String, default: null },
    last_error: { type: String, default: null },
    expire_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

QueueJobSchema.index({ queue: 1, job_id: 1 }, { unique: true });
QueueJobSchema.index({ queue: 1, status: 1, run_at: 1 });
QueueJobSchema.index({ expire_at: 1 }, { expireAfterSeconds: 0 });

export const QueueJob =
  mongoose.models.QueueJob ||
  mongoose.model<IQueueJobDoc>("QueueJob", QueueJobSchema, "queue_jobs");
