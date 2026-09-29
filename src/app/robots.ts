import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

/** /robots.txt — index everything public, keep the API out of crawlers. */
export default function robots(): MetadataRoute.Robots {
  const base = siteConfig.url.replace(/\/+$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
