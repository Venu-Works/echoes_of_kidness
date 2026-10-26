// Backend-neutral job types shared by the Redis and MongoDB queues

export interface ModerationJobData {
  storyId: string;
  storyTitle: string;
  storyBody: string;
  storyThemes: string[];
  userEmail?: string;
  submittedAt?: string;
}

export interface IllustrationJobData {
  storyId: string;
}

export interface JobContext<T> {
  id: string;
  data: T;
  // 1 on the first try, 2 on the first retry, …
  attempt: number;
  maxAttempts: number;
  isLastAttempt: boolean;
}

export type JobHandler<T> = (job: JobContext<T>) => Promise<unknown>;

// Throw this from a handler when retrying cannot help (e.g. missing config)
export class PermanentJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentJobError";
  }
}

// Exponential backoff, matching BullMQ's: base, 2×base, 4×base, …
export function retryDelayMs(backoffMs: number, attemptsMade: number): number {
  return backoffMs * 2 ** Math.max(0, attemptsMade - 1);
}

// What to do after a failed attempt
export function afterFailure(attemptsMade: number, maxAttempts: number, permanent: boolean): "retry" | "fail" {
  return permanent || attemptsMade >= maxAttempts ? "fail" : "retry";
}
