/** @type {import('next').NextConfig} */
const nextConfig = {
  // Production builds write to their own dir so `next build` can never clobber
  // the .next cache of a running `next dev` server (which crashes the app).
  distDir: process.env.NODE_ENV === "production" ? ".next-build" : ".next",
  reactStrictMode: true,
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: ["**/.git/**", "**/.next/**", "**/node_modules/**"]
      };
    }
    return config;
  }
};

module.exports = nextConfig;
