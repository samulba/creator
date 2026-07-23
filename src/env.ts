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

export const env = {
  NODE_ENV: parseNodeEnvironment(process.env.NODE_ENV),
};
