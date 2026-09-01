import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://managikahomes.co.ke";

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/start`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      // Public pricing/marketing page - was live and linked from the
      // homepage but never listed here, so search engines had no direct
      // signal to index it even though it's exactly the page competing
      // for "property management software Kenya"-type searches.
      url: `${baseUrl}/for-landlords`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
  ];
}
