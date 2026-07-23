const fallbackPath = "/app";

export function getSafeAuthRedirect(value: string | null | undefined) {
  if (!value) {
    return fallbackPath;
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    return fallbackPath;
  }

  if (!value.startsWith("/app")) {
    return fallbackPath;
  }

  return value;
}
