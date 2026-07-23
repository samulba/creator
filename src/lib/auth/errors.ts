export function getFriendlyAuthError(message: string | undefined) {
  const normalizedMessage = message?.toLowerCase() ?? "";

  if (normalizedMessage.includes("invalid login credentials")) {
    return "The email or password does not match an account.";
  }

  if (normalizedMessage.includes("email not confirmed")) {
    return "Confirm your email before logging in.";
  }

  if (
    normalizedMessage.includes("already registered") ||
    normalizedMessage.includes("already exists")
  ) {
    return "An account already exists for that email. Log in instead.";
  }

  if (
    normalizedMessage.includes("password") &&
    normalizedMessage.includes("weak")
  ) {
    return "Choose a stronger password.";
  }

  if (
    normalizedMessage.includes("password") &&
    normalizedMessage.includes("6")
  ) {
    return "Use a password with at least 6 characters.";
  }

  if (normalizedMessage.includes("invalid email")) {
    return "Enter a valid email address.";
  }

  if (
    normalizedMessage.includes("fetch") ||
    normalizedMessage.includes("network")
  ) {
    return "Creator could not reach authentication. Check your connection and try again.";
  }

  return "Authentication failed. Check your details and try again.";
}
