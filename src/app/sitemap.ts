import type { MetadataRoute } from "next";
import { SITE_URL, LOCALES } from "@/lib/site";
import { BLOG_POSTS } from "@/lib/blog";

const url = (locale: string, path: string) =>
  `${SITE_URL}/${locale}${path ? "/" + path : ""}`;

const languages = (path: string) => ({
  "x-default": url("en", path),
  en: url("en", path),
  hi: url("hi", path),
  mr: url("mr", path),
});

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();

  // Indexable pages only. today/overview/kundli are client-rendered from local
  // birth details (a crawler sees an empty shell) and are marked noindex, so
  // they are deliberately absent here.
  const corePaths = [
    { path: "", priority: 1, freq: "weekly" as const },
    { path: "details", priority: 0.9, freq: "weekly" as const },
    { path: "chat", priority: 0.8, freq: "weekly" as const },
    { path: "blog", priority: 0.7, freq: "weekly" as const },
    { path: "legal/privacy", priority: 0.2, freq: "yearly" as const },
    { path: "legal/terms", priority: 0.2, freq: "yearly" as const },
    { path: "sitemap", priority: 0.3, freq: "monthly" as const },
  ];

  const urls: MetadataRoute.Sitemap = [];

  for (const loc of LOCALES) {
    for (const p of corePaths) {
      urls.push({
        url: url(loc, p.path),
        lastModified: now,
        changeFrequency: p.freq,
        priority: p.priority,
        alternates: { languages: languages(p.path) },
      });
    }
  }

  // Blog posts are English-only and canonicalise to /en, so list only /en.
  for (const post of BLOG_POSTS) {
    urls.push({
      url: url("en", `blog/${post.slug}`),
      lastModified: post.date,
      changeFrequency: "monthly",
      priority: 0.6,
    });
  }

  return urls;
}
