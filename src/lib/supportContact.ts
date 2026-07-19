type SupportEnvironment = {
  [key: string]: string | undefined;
  ENABLE_PAID_UNLOCKS?: string;
  SUPPORT_EMAIL?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function activeSupportEmail(env: SupportEnvironment = process.env): string | null {
  const supportEmail = env.SUPPORT_EMAIL?.trim() ?? "";

  if (supportEmail && !emailPattern.test(supportEmail)) {
    throw new Error("SUPPORT_EMAIL must be a valid email address");
  }
  if (env.ENABLE_PAID_UNLOCKS === "1" && !supportEmail) {
    throw new Error("SUPPORT_EMAIL is required before paid unlocks can be enabled");
  }

  return supportEmail || null;
}
