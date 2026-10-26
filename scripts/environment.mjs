import mongoose from "mongoose";

export function validateEnvironment(env, target, production) {
  const errors = [];
  const required = target === "worker"
    ? ["MONGODB_URI", "SITE_URL", "GEMINI_API_KEY", "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"]
    : ["MONGODB_URI", "SITE_URL", "NEXTAUTH_URL", "NEXTAUTH_SECRET", "ADMIN_EMAILS"];
  // Keep in step with lib/queue/config.ts
  const backend = (env.QUEUE_BACKEND ?? "redis").trim().toLowerCase() || "redis";
  if (!["redis", "mongo"].includes(backend)) errors.push("QUEUE_BACKEND must be redis or mongo");
  if (backend === "redis") required.push("REDIS_URL");
  if (env.MONGO_QUEUE_POLL_SECONDS && (!Number.isFinite(Number(env.MONGO_QUEUE_POLL_SECONDS)) || Number(env.MONGO_QUEUE_POLL_SECONDS) < 1 || Number(env.MONGO_QUEUE_POLL_SECONDS) > 60)) errors.push("MONGO_QUEUE_POLL_SECONDS must be a number from 1 to 60");
  const provider = env.AI_PROVIDER || "claude";
  if (target === "worker") {
    if (env.EMAIL_ENABLED !== undefined && !["true", "false"].includes(env.EMAIL_ENABLED)) errors.push("EMAIL_ENABLED must be true or false");
    if (env.EMAIL_ENABLED !== "false") required.push("RESEND_API_KEY", "EMAIL_FROM");
    if (!["claude", "gemini"].includes(provider)) errors.push("AI_PROVIDER must be claude or gemini");
    if (provider === "claude") required.push("ANTHROPIC_API_KEY");
    for (const name of ["MODERATION_CONCURRENCY", "ILLUSTRATION_CONCURRENCY"]) {
      if (env[name] && (!Number.isInteger(Number(env[name])) || Number(env[name]) < 1 || Number(env[name]) > 20)) errors.push(`${name} must be an integer from 1 to 20`);
    }
    // Keep in step with lib/queue/polling.ts
    for (const [name, min, max] of [["WORKER_IDLE_WAIT_SECONDS", 5, 600], ["WORKER_STALLED_CHECK_SECONDS", 30, 3600]]) {
      if (env[name] && (!Number.isFinite(Number(env[name])) || Number(env[name]) < min || Number(env[name]) > max)) errors.push(`${name} must be a number from ${min} to ${max}`);
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
  if (env.MONGODB_URI) {
    // WHATWG URL rejects valid multi-host MongoDB replica-set addresses.
    // Construction validates syntax without opening a database connection.
    try { new mongoose.mongo.MongoClient(env.MONGODB_URI); }
    catch { errors.push("MONGODB_URI has an invalid connection URL"); }
  }
  if (env.REDIS_URL) {
    try { if (!["redis:", "rediss:"].includes(new URL(env.REDIS_URL).protocol)) throw new Error(); }
    catch { errors.push("REDIS_URL has an invalid connection URL"); }
  }
  if (target === "worker" && env.EMAIL_ENABLED !== "false" && env.EMAIL_FROM && !/^[^<>]*<?[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+>?$/.test(env.EMAIL_FROM)) errors.push("EMAIL_FROM must contain a sender email address");
  return errors;
}
