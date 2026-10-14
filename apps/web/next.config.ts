import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@mrac/ui", "@mrac/api", "@mrac/auth", "@mrac/db"],
  serverExternalPackages: ["@prisma/client"],
  devIndicators: { position: "bottom-right" },
  /** Keep the current site's URLs working (SEO + bookmarks). */
  async redirects() {
    return [
      { source: "/about-mr-rent-a-car", destination: "/about-us", permanent: true },
      { source: "/select-vehicle", destination: "/book", permanent: true },
    ];
  },
};

export default nextConfig;
