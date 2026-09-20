/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.BUILD_STANDALONE === '1' ? { output: 'standalone' } : {}),
};

export default nextConfig;
