import dotenv from "dotenv";
import { validateEnvironment } from "./environment.mjs";

dotenv.config({ path: ".env.local" });
const target = process.argv.includes("--worker") ? "worker" : "web";
const errors = validateEnvironment(process.env, target, process.argv.includes("--production") || process.env.NODE_ENV === "production");
if (errors.length) {
  console.error(`Invalid ${target} environment:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  process.exitCode = 1;
} else {
  console.log(`${target} environment checks passed (values are never printed).`);
}
