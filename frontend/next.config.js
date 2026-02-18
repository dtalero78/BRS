/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,

  // TypeScript
  typescript: {
    ignoreBuildErrors: true,
  },

  // Images - use unoptimized for static export
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;