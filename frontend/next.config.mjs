/** @type {import('next').NextConfig} */
function apiOrigin() {
  const raw = process.env.API_ORIGIN?.trim();
  if (!raw) return null;
  return new URL(raw).origin;
}

const nextConfig = {
  async rewrites() {
    const origin = apiOrigin();
    return origin ? [{ source: "/api/:path*", destination: `${origin}/api/:path*` }] : [];
  },
};

export default nextConfig;