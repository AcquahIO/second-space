/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@second-space/shared-types",
    "@second-space/sim-engine",
    "@second-space/tool-adapters"
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb"
    }
  }
};

export default nextConfig;
