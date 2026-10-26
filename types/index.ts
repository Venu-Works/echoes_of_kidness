export type StoryStatus = "pending" | "approved" | "rejected" | "human_review";
export type ThemeTag = "love" | "respect" | "gratitude" | "kindness";
export const REACTION_TYPES = ["gratitude", "respect", "love", "applause"] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];
export type ReactionCounts = Record<ReactionType, number>;

export type AuthProvider = "google" | "facebook" | "twitter" | "credentials" | "anonymous";

export interface SafetyResult {
  safe: boolean;
  flags: string[];
  confidence: number;
}

export interface RelevanceResult {
  relevant: boolean;
  theme_confidence: number;
  detected_themes: ThemeTag[];
  reason: string;
}

export interface QualityResult {
  quality_pass: boolean;
  // Clear-cut spam/test/gibberish — the only quality failure that auto-rejects
  obvious_junk: boolean;
  coherent: boolean;
  reason: string;
}

export interface OrchestratorVerdict {
  status: StoryStatus;
  reason: string;
  safety: SafetyResult;
  relevance: RelevanceResult;
  quality: QualityResult;
}

export interface IStory {
  _id: string;
  user_id: string | null;
  display_name: string;
  title: string;
  body: string;
  theme: ThemeTag[];
  word_count: number;
  status: StoryStatus;
  submitted_at: Date;
  published_at: Date | null;
  image_url: string | null;
  image_status: "none" | "pending" | "ready" | "failed";
}

export interface IUser {
  _id: string;
  name: string;
  email: string;
  password_hash?: string;
  auth_provider: AuthProvider;
  created_at: Date;
}
