/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    API_URL: process.env.API_URL || 'http://localhost:5000/api',
  },
  
  // Enable TypeScript strict mode
  typescript: {
    // Don't fail build on type errors during development
    ignoreBuildErrors: process.env.NODE_ENV === 'development',
  },

  // Images configuration
  images: {
    remotePatterns: [],
  },

  // Experimental features
  experimental: {
    // Remove deprecated appDir option
  },

  // Rewrites for API proxy in development
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_URL || 'http://localhost:5000/api'}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;