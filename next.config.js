/** @type {import('next').NextConfig} */
const nextConfig = {
  // Using Vercel's native Node.js runtime (no static export)
  // This allows server-side rendering and API routes
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  swcMinify: true,
  productionBrowserSourceMaps: false,
};
module.exports = nextConfig;
