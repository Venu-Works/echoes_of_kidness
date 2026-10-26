import mongoose, { Schema, Document } from "mongoose";

// People given moderation access from the admin UI. Keyed by email so access
// can be granted before the person has an account; it applies as soon as
// they sign in with that email. Owners (ADMIN_EMAILS) are not stored here.
export interface IStaffMemberDoc extends Document {
  email: string; // lower-cased
  role: "moderator" | "admin";
  added_by: string;
  added_at: Date;
  updated_by: string | null;
  updated_at: Date | null;
}

const StaffMemberSchema = new Schema<IStaffMemberDoc>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  role: { type: String, enum: ["moderator", "admin"], required: true },
  added_by: { type: String, required: true },
  added_at: { type: Date, default: Date.now },
  updated_by: { type: String, default: null },
  updated_at: { type: Date, default: null },
});

export const StaffMember =
  mongoose.models.StaffMember ||
  mongoose.model<IStaffMemberDoc>("StaffMember", StaffMemberSchema, "staff_members");
