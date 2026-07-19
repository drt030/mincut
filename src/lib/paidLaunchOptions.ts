export type PaidLaunchOptions = {
  requireEnabled: boolean;
  requireLive: boolean;
  verifyStripe: boolean;
};

type PaidLaunchEnv = Record<string, string | undefined>;

export function paidLaunchOptions(args: readonly string[], env: PaidLaunchEnv): PaidLaunchOptions {
  const enabledProductionDeploy =
    env.VERCEL_ENV === "production" && env.ENABLE_PAID_UNLOCKS === "1";

  return {
    requireEnabled: args.includes("--require-enabled") || enabledProductionDeploy,
    requireLive: args.includes("--require-live") || enabledProductionDeploy,
    verifyStripe: args.includes("--verify-stripe") || enabledProductionDeploy,
  };
}
