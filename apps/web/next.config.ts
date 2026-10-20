import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const nextConfig: NextConfig = {
  env: {
    DATABASE_URL:
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@db:5432/mrac?schema=public",
  },
  transpilePackages: ["@mrac/ui", "@mrac/api", "@mrac/auth", "@mrac/db"],
  serverExternalPackages: ["@prisma/client"],
  devIndicators: { position: "bottom-right" },
  // Dev in Docker on Windows uses file polling: don't watch folders that never hold app code (they are large and slow it down)
  webpack(config, { dev }) {
    if (dev)
      config.watchOptions = {
        ...config.watchOptions,
        poll: 2000,
        aggregateTimeout: 600,
        ignored: ["**/node_modules/**", "**/.git/**", "**/.next/**", "**/.turbo/**", "**/.claude/**", "**/packages/db/prisma/legacy/**", "**/packages/db/prisma/migrations/**"],
      };
    return config;
  },
  /** Keep the current site's URLs working (SEO + bookmarks). */
  async redirects() {
    return [
      { source: "/about-mr-rent-a-car", destination: "/about-us", permanent: true },
      { source: "/select-vehicle", destination: "/book", permanent: true },
    ];
  },
};

// `next dev` builds into .next/dev, so it never overwrites the production build (`next build` / `next start`) in .next
export default (phase: string): NextConfig => ({ ...nextConfig, distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next/dev" : ".next" });
