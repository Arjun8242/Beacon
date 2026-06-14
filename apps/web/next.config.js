/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Docker multi-stage builds – outputs a self-contained server
  output: 'standalone',

  async rewrites() {
    const apiBase = process.env.API_URL ?? 'http://localhost:3001';
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiBase}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
