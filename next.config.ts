import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  // pdfkit อ่านไฟล์ฟอนต์ภายในของตัวเองตอนรัน จึงไม่ต้อง bundle · ฟอนต์ไทยที่ฝังใน PDF ต้องถูกรวมไปกับ serverless function
  serverExternalPackages: ["pdfkit"],
  outputFileTracingIncludes: { "/api/export-pdf": ["./assets/fonts/**/*"] },
  partialPrefetching: true,
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
