import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@bitshelf/api", "@bitshelf/db", "@bitshelf/ui"],
};

export default nextConfig;
