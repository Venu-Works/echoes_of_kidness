import { execFileSync } from "node:child_process";
import { deployWorker } from "./deploy-render.mjs";

const commitId = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
deployWorker({ apiKey: process.env.RENDER_API_KEY, serviceId: process.env.RENDER_SERVICE_ID, commitId }).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
