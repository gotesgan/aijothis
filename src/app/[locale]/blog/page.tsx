import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { BLOG_POSTS } from "@/lib/blog";
import { LOCALES, SITE_NAME } from "@/lib/site";

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
    title: "Vedic Astrology Guides & Blog",
    description:
      "Practical, plain-language guides to Kundli, marriage timing, Kundli matching, Muhurat and the 27 Nakshatras — written for real people, not astrologers.",
    alternates: {
      canonical: `/${locale}/blog`,
      languages: {
        "x-default": "/en/blog",
        en: "/en/blog",
        hi: "/hi/blog",
        mr: "/mr/blog",
      },
    },
  };
}

export default async function BlogIndex({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "Blog" });

  return (
    <main className="blog">
      <header className="blog__hero">
        <h1>{t("title")}</h1>
        <p>{t("subtitle")}</p>
      </header>

      <div className="blog__list">
        {BLOG_POSTS.map((post) => (
          <article key={post.slug} className="blog__card">
            <h2>
              <Link href={`/blog/${post.slug}`}>{post.title}</Link>
            </h2>
            <p className="blog__meta">
              {post.date} · {post.readingMinutes} min read
            </p>
            <p className="blog__excerpt">{post.description}</p>
          </article>
        ))}
      </div>

      <p className="blog__cta">
        {t("cta")} <Link href="/chat">{SITE_NAME} →</Link>
      </p>
    </main>
  );
}
