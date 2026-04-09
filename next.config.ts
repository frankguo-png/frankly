import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  images: {
    formats: ['image/webp'],
  },
  experimental: {
    optimizePackageImports: ['recharts', '@xyflow/react', 'lucide-react', 'date-fns'],
  },
};

export default nextConfig;
