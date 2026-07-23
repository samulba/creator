const allowedNodeEnvironments = ["development", "test", "production"] as const;

type NodeEnvironment = (typeof allowedNodeEnvironments)[number];

function parseNodeEnvironment(value: string | undefined): NodeEnvironment {
  if (allowedNodeEnvironments.includes(value as NodeEnvironment)) {
    return value as NodeEnvironment;
  }

  throw new Error(
    `Invalid NODE_ENV value. Expected one of: ${allowedNodeEnvironments.join(", ")}.`,
  );
}

function requireEnvironmentVariable(name: string): string {
  const value = process.env[name];

  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  throw new Error(`Missing required environment variable: ${name}.`);
}

function requireUrlEnvironmentVariable(name: string): string {
  const value = requireEnvironmentVariable(name);

  try {
    new URL(value);
  } catch {
    throw new Error(`Invalid ${name} value. Expected a valid URL.`);
  }

  return value;
}

export const env = {
  NODE_ENV: parseNodeEnvironment(process.env.NODE_ENV),
};

export function getSupabaseEnvironment() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: requireUrlEnvironmentVariable(
      "NEXT_PUBLIC_SUPABASE_URL",
    ),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: requireEnvironmentVariable(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ),
  };
}
