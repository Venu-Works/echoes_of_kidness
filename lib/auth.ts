import { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectDB } from "./mongodb";
import { User } from "@/models/User";
import { getStaffAccess, StaffRole } from "./staffRoles";

const STAFF_ROLE_REFRESH_MS = 60 * 1000;

export const authOptions: AuthOptions = {
  session: { strategy: "jwt" },
  providers: [
    CredentialsProvider({
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        await connectDB();
        const user = await User.findOne({
          email: credentials.email,
          auth_provider: "credentials",
        });

        if (!user || !user.password_hash) return null;

        const valid = await bcrypt.compare(
          credentials.password,
          user.password_hash
        );
        if (!valid) return null;

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.sub = user.id;
      // Staff role, used only to decide which links to show. It is refreshed
      // every minute; every staff action re-checks the database (lib/staff.ts).
      const checkedAt = (token.staffCheckedAt as number | undefined) ?? 0;
      if (user || Date.now() - checkedAt > STAFF_ROLE_REFRESH_MS) {
        try {
          const access = await getStaffAccess(token.email);
          token.staffRole = access?.role ?? null;
          token.staffCheckedAt = Date.now();
        } catch {
          // Keep the previous value if the database is briefly unavailable
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub && session.user) {
        (session.user as { id?: string }).id = token.sub;
      }
      if (session.user) {
        (session.user as { staffRole?: StaffRole | null }).staffRole =
          (token.staffRole as StaffRole | null | undefined) ?? null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
