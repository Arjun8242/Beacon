/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_API_URL;
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiBase}/api/v1/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
