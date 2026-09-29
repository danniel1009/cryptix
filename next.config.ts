import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow `NEXT_DIST_DIR=.next-build next build` so a production build never
  // clobbers a running dev server's output (both default to `.next`).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
