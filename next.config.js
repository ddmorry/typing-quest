/** @type {import('next').NextConfig} */
const nextConfig = {
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