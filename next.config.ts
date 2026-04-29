import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mongoose", "bullmq", "ioredis"],
};

export default nextConfig;
