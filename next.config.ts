import type { NextConfig } from "next";

// Standalone output keeps the production image to the app plus its resolved
// dependencies, per docs/architecture/adr-0002-geodata-stack.md.
const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
