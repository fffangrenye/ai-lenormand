/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    const staticPageCache = "public, max-age=1800, s-maxage=86400, stale-while-revalidate=3600";
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
