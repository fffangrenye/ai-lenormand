/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=300, stale-while-revalidate=60"
          }
        ]
      },
      {
        source: "/:path(forgot-password|login|daily|yes-no|deep|oracle|space|profile|knowledge)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=300, stale-while-revalidate=60"
          }
        ]
      }
    ];
  }
};

export default nextConfig;
