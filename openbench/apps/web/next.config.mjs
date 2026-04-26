const useStandaloneOutput =
  process.env.NEXT_OUTPUT_STANDALONE === "true" ||
  (process.env.NEXT_OUTPUT_STANDALONE !== "false" && process.platform !== "win32");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: useStandaloneOutput ? "standalone" : undefined,
  reactStrictMode: true,
  experimental: {
    typedRoutes: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  transpilePackages: ["@openbench/schemas"],
  async redirects() {
    return [
      { source: "/", destination: "/console", permanent: false },
    ];
  },
  async headers() {
    // CSP: tighter in production, looser in dev to allow Next.js HMR.
    const scriptSrc =
      process.env.NODE_ENV === "development"
        ? "'self' 'unsafe-inline' 'unsafe-eval'"
        : "'self' 'unsafe-inline'";
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `script-src ${scriptSrc}`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: http: https:",
              "connect-src 'self' http://localhost:8000 http://127.0.0.1:8000 https:",
              "font-src 'self' data:",
              "object-src 'none'",
              "base-uri 'self'",
              "frame-ancestors 'none'",
              "form-action 'self'",
            ].join("; "),
          },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
