import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.mypinata.cloud',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
