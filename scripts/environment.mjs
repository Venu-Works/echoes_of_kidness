export function validateEnvironment(env, target, production) {
  const errors = [];
  const required = target === "worker"
    ? ["MONGODB_URI", "REDIS_URL", "SITE_URL", "GEMINI_API_KEY", "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "RESEND_API_KEY", "EMAIL_FROM"]
    : ["MONGODB_URI", "REDIS_URL", "SITE_URL", "NEXTAUTH_URL", "NEXTAUTH_SECRET", "ADMIN_EMAILS"];
  const provider = env.AI_PROVIDER || "claude";
  if (target === "worker") {
    if (!["claude", "gemini"].includes(provider)) errors.push("AI_PROVIDER must be claude or gemini");
    if (provider === "claude") required.push("ANTHROPIC_API_KEY");
    for (const name of ["MODERATION_CONCURRENCY", "ILLUSTRATION_CONCURRENCY"]) {
      if (env[name] && (!Number.isInteger(Number(env[name])) || Number(env[name]) < 1 || Number(env[name]) > 20)) errors.push(`${name} must be an integer from 1 to 20`);
    }
  }
  for (const key of required) {
    if (!env[key]?.trim()) errors.push(`${key} is required`);
  }
  for (const key of ["SITE_URL", ...(target === "web" ? ["NEXTAUTH_URL"] : [])]) {
    if (!env[key]) continue;
    try {
      const url = new URL(env[key]);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error();
      if (production && (url.protocol !== "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) throw new Error();
    } catch { errors.push(`${key} must be a public HTTPS origin in production (no path, credentials, query, or fragment)`); }
  }
  if (target === "web" && env.SITE_URL && env.NEXTAUTH_URL && env.SITE_URL.replace(/\/$/, "") !== env.NEXTAUTH_URL.replace(/\/$/, "")) errors.push("SITE_URL and NEXTAUTH_URL must use the same origin");
  if (target === "web" && production && env.NEXTAUTH_SECRET && (env.NEXTAUTH_SECRET.length < 32 || /^(change|replace|your-|example)/i.test(env.NEXTAUTH_SECRET))) errors.push("NEXTAUTH_SECRET must be a generated secret of at least 32 characters");
  for (const [key, protocols] of [["MONGODB_URI", ["mongodb:", "mongodb+srv:"]], ["REDIS_URL", ["redis:", "rediss:"]]]) {
    if (env[key]) {
      try { if (!protocols.includes(new URL(env[key]).protocol)) throw new Error(); }
      catch { errors.push(`${key} has an invalid connection URL`); }
    }
  }
  if (target === "worker" && env.EMAIL_FROM && !/^[^<>]*<?[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+>?$/.test(env.EMAIL_FROM)) errors.push("EMAIL_FROM must contain a sender email address");
  return errors;
}
