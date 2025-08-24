/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Disable React Strict Mode to prevent double rendering
  webpack: (config, { isServer }) => {
    // Handle Phaser build for client-side
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        // Ensure Phaser works in browser environment
      };
    }
    
    return config;
  },
}

module.exports = nextConfig