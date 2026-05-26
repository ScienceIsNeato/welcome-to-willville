import type { NextConfig } from "next";

const staticGenerationWorkers = Number.parseInt(
  process.env.NEXT_STATIC_GENERATION_WORKERS ?? "4",
  10,
);

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  experimental: {
    cpus: Number.isFinite(staticGenerationWorkers)
      ? Math.max(1, staticGenerationWorkers)
      : 4,
    staticGenerationMinPagesPerWorker: 6,
  },
};

export default nextConfig;
