/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingExcludes: { "**": ["./.local-paid/**/*", "./.env*", "./.git/**/*", "./.wrangler/**/*"] }
  },
  ...(process.env.PAID_LOCAL_MODE === "1" ? { distDir: ".next-paid-local" } : {}),
  webpack(config) {
    config.externals.push({ "node:sqlite": "commonjs node:sqlite" });
    return config;
  },
  async headers() {
    const staticPageCache = "public, max-age=0, s-maxage=60, stale-while-revalidate=30";
    const staticAssetCache = "public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400";

    return [
      {
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: staticPageCache
          }
        ]
      },
      {
        source: "/:path(forgot-password|login|daily|yes-no|deep|oracle|space|profile|knowledge)",
        headers: [
          {
            key: "Cache-Control",
            value: staticPageCache
          }
        ]
      },
      {
        source: "/:path*\\.(png|jpg|jpeg|webp|gif|svg|ico)",
        headers: [
          {
            key: "Cache-Control",
            value: staticAssetCache
          }
        ]
      }
    ];
  }
};

export default nextConfig;
