import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Allow an isolated build dir (e.g. a parallel QA dev server) via env so two
  // `next dev` processes don't clobber a shared .next cache. Defaults to .next.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // Graph pages read data/**/*.json with fs at request time; explicit tracing
  // keeps them in the serverless bundle on Vercel.
  outputFileTracingIncludes: { "/**": ["./data/**/*.json"] },
};

export default nextConfig;
