import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { BLOG_POSTS } from "@/lib/blog";
import { LOCALES } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "Sitemap",
    description: "Every page on Jyotish — Vedic astrology guides and tools.",
    alternates: {
      canonical: `/${locale}/sitemap`,
      languages: {
        "x-default": "/en/sitemap",
        en: "/en/sitemap",
        hi: "/hi/sitemap",
        mr: "/mr/sitemap",
      },
    },
  };
}

const CORE = [
  { path: "/", label: "Home" },
  { path: "/details", label: "Get your Kundli" },
  { path: "/chat", label: "Ask Arya (Chat)" },
  { path: "/today", label: "Today's reading" },
  { path: "/overview", label: "Overview" },
  { path: "/kundli", label: "My Kundli" },
  { path: "/blog", label: "Blog" },
  { path: "/legal/privacy", label: "Privacy Policy" },
  { path: "/legal/terms", label: "Terms & Conditions" },
];

export default async function SitemapPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Blog");

  return (
    <main className="blog">
      <header className="blog__hero">
        <h1>Sitemap</h1>
        <p>All pages on Jyotish — in {locale === "en" ? "English" : locale === "hi" ? "Hindi" : "Marathi"}.</p>
      </header>

      <section className="blog__list">
        <h2 style={{ fontSize: "1.1rem" }}>Pages</h2>
        <ul className="sitemap__list">
          {CORE.map((c) => (
            <li key={c.path}>
              <Link href={c.path}>{c.label}</Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="blog__list" style={{ marginTop: 20 }}>
        <h2 style={{ fontSize: "1.1rem" }}>Vedic Astrology Guides</h2>
        <ul className="sitemap__list">
          {BLOG_POSTS.map((post) => (
            <li key={post.slug}>
              <Link href={`/blog/${post.slug}`}>{post.title}</Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="blog__cta">
        {t("cta")} <Link href="/chat">Arya →</Link>
      </p>
    </main>
  );
}
