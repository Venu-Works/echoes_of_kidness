import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { randomUUID } from "crypto";
import { authOptions } from "@/lib/auth";

export const VISITOR_COOKIE = "hw_visitor";

// Identifies who is reacting: the signed-in user if there is one, otherwise
// an anonymous visitor ID kept in a long-lived cookie.
// Pass create=true from route handlers (which can set cookies) to issue a new
// visitor ID; server components can only read an existing one.
export async function getReactorKey(create = false): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (userId) return `user:${userId}`;

  const jar = await cookies();
  let visitorId = jar.get(VISITOR_COOKIE)?.value;
  if (!visitorId && create) {
    visitorId = randomUUID();
    jar.set(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365 * 2,
      path: "/",
    });
  }
  return visitorId ? `visitor:${visitorId}` : null;
}
