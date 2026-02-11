/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    turbo: {
      resolveAlias: {
        '@': './src',
        '@/': './src/'
      }
    }
  }
};
module.exports = nextConfig;
