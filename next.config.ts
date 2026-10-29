import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // pdfkit อ่านไฟล์ฟอนต์ภายในของตัวเองตอนรัน จึงไม่ต้อง bundle · ฟอนต์ไทยที่ฝังใน PDF ต้องถูกรวมไปกับ serverless function
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: { "/api/export-pdf": ["./assets/fonts/**/*"] },
  partialPrefetching: true,
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
