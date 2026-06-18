/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: require('path').join(__dirname, '../'),
  allowedDevOrigins: ['*.replit.dev', '*.repl.co', '*.spock.replit.dev', '*.picard.replit.dev'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `http://localhost:8000/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
