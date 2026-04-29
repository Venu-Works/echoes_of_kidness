export type StoryStatus = "pending" | "approved" | "rejected" | "human_review";
export type ThemeTag = "love" | "respect" | "gratitude";
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
  word_count: number;
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
}

export interface IUser {
  _id: string;
  name: string;
  email: string;
  password_hash?: string;
  auth_provider: AuthProvider;
  created_at: Date;
}
