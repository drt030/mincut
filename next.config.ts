import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Graph pages read data/**/*.json with fs at request time; explicit tracing
  // keeps them in the serverless bundle on Vercel.
  outputFileTracingIncludes: { "/**": ["./data/**/*.json"] },
};

export default nextConfig;
