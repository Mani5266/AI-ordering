/** @type {import('next').NextConfig} */
const nextConfig = {
  // Security headers on every response (PRD 9/T6). Same-origin: no CORS headers set anywhere.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://*.omnidim.io https://*.vapi.ai; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self' ws://localhost:* wss://live.omnidim.io https://*.omnidim.io https://*.vapi.ai; worker-src 'self' blob:; frame-ancestors 'self'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
