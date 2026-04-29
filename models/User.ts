import mongoose, { Schema, Document } from "mongoose";

export interface IUserDoc extends Document {
  name: string;
  email: string;
  password_hash?: string;
  auth_provider: "google" | "facebook" | "twitter" | "credentials" | "anonymous";
  created_at: Date;
}

const UserSchema = new Schema<IUserDoc>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password_hash: { type: String },
  auth_provider: {
    type: String,
    enum: ["google", "facebook", "twitter", "credentials", "anonymous"],
    required: true,
  },
  created_at: { type: Date, default: Date.now },
});

export const User =
  mongoose.models.User || mongoose.model<IUserDoc>("User", UserSchema);
