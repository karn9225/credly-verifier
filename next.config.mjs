/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.credly.com" },
      { protocol: "https", hostname: "images.credly.com" },
      { protocol: "https", hostname: "**.youracclaim.com" },
    ],
  },
};

export default nextConfig;
