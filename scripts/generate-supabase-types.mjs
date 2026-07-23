import { spawnSync } from "node:child_process";

const projectId = process.env.SUPABASE_PROJECT_ID;
const args = projectId
  ? [
      "supabase",
      "gen",
      "types",
      "typescript",
      "--project-id",
      projectId,
      "--schema",
      "public",
    ]
  : ["supabase", "gen", "types", "typescript", "--local", "--schema", "public"];

const result = spawnSync("npx", args, { stdio: "inherit" });
process.exit(result.status ?? 1);
