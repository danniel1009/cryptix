import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

/** /sitemap.xml — single-page site; sections are anchors, not routes. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url.replace(/\/+$/, "");
  return [
    {
      url: `${base}/`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}
