// Set SITE_URL (or NEXTAUTH_URL) to the public domain in production.
export function getSiteUrl(): URL {
  return new URL(
    process.env.SITE_URL ||
      process.env.NEXTAUTH_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "http://localhost:3000")
  );
}
