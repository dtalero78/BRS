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

  // Dev proxy: forward /api to backend (only active in `next dev`, ignored in static export)
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `http://localhost:${process.env.BACKEND_PORT || 5002}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;