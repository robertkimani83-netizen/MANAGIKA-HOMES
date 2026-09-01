import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/landlord/",
        "/tenant/",
        "/properties",
        "/units",
        "/tenants",
        "/payments",
        "/payment-settings",
        "/maintenance",
        "/complaints",
        "/ai-assistant",
        "/screening",
        "/team",
        "/staff/",
      ],
    },
    sitemap: "https://managikahomes.co.ke/sitemap.xml",
  };
}
