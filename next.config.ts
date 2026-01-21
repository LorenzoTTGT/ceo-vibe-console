import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // Allow iframe embedding from the preview domain
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
