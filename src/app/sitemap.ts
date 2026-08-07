import type { MetadataRoute } from "next";
import { SITE_URL, LOCALES } from "@/lib/site";
import { BLOG_POSTS } from "@/lib/blog";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();
  const corePaths = [
    { path: "", priority: 1, freq: "weekly" as const },
    { path: "details", priority: 0.9, freq: "weekly" as const },
    { path: "chat", priority: 0.8, freq: "weekly" as const },
    { path: "today", priority: 0.6, freq: "daily" as const },
    { path: "overview", priority: 0.6, freq: "weekly" as const },
    { path: "kundli", priority: 0.6, freq: "weekly" as const },
    { path: "blog", priority: 0.7, freq: "weekly" as const },
  ];

  const urls: MetadataRoute.Sitemap = [];
  for (const loc of LOCALES) {
    for (const p of corePaths) {
      urls.push({
        url: `${SITE_URL}/${loc}${p.path ? "/" + p.path : ""}`,
        lastModified: now,
        changeFrequency: p.freq,
        priority: p.priority,
      });
    }
    for (const post of BLOG_POSTS) {
      urls.push({
        url: `${SITE_URL}/${loc}/blog/${post.slug}`,
        lastModified: post.date,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  }
  return urls;
}
