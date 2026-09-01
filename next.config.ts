import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // The site was shipping with no security response headers at all (checked
  // live via managikahomes.co.ke - only Vercel's own defaults, like HSTS,
  // were present). These are the standard, low-risk ones: they don't touch
  // anything Supabase/Gemini calls rely on, so nothing about the app's own
  // behavior changes. The one that actually matters most here is
  // X-Frame-Options - without it, another site could load /landlord/login
  // or a dashboard page inside an invisible iframe and trick a signed-in
  // landlord into clicking something (confirming a payment claim, deleting
  // a tenant) via a clickjacking overlay. A Content-Security-Policy header
  // would add more, but was left out deliberately - getting a CSP wrong
  // (missing an allowed host for Supabase/Google Fonts) can silently break
  // the live site, and that needs testing against every page rather than a
  // blind config change.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
