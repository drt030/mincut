import type { Metadata } from "next";

type InternalRouteEnvironment = {
  NODE_ENV?: string;
  NEXT_PUBLIC_OPERATOR_MODE?: string;
  VERCEL_ENV?: string;
};

/**
 * Internal research surfaces stay convenient in local development, but are
 * closed in production. A local production build may explicitly opt back in
 * with the existing operator-mode flag; Vercel deployments always fail closed.
 */
export function internalRoutesAvailable(env: InternalRouteEnvironment = process.env): boolean {
  if (env.NODE_ENV !== "production") return true;
  return !env.VERCEL_ENV && env.NEXT_PUBLIC_OPERATOR_MODE === "1";
}

export const INTERNAL_ROUTE_METADATA: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};
