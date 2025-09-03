/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@univerjs/core',
    '@univerjs/design',
    '@univerjs/docs',
    '@univerjs/docs-ui',
    '@univerjs/ui',
    '@univerjs/engine-render',
    '@univerjs/engine-formula'
  ],
  webpack: (config, { isServer }) => {
    // Handle fallbacks for browser compatibility
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      }
    }

    return config
  }
}

module.exports = nextConfig