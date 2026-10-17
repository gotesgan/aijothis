import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Header } from "@/components/header";
import { NavagrahaMandala } from "@/components/navagraha-mandala";
import { AppNav } from "@/components/app-nav";
import { ConsentSettingsLink } from "@/components/consent-banner";
import { JsonLd } from "@/components/json-ld";
import { Link } from "@/i18n/navigation";
import { SITE_URL } from "@/lib/site";
import { alternatesFor } from "@/lib/seo";
import { BLOG_POSTS } from "@/lib/blog";
import { Sun, ChevronRight } from "lucide-react";
import { ResumeGate } from "@/components/resume-gate";
import type { Metadata } from "next";

const titles: Record<string, { title: string; description: string }> = {
  en: {
    title: "Jyotish — AI Vedic Astrologer | Free Kundli & Chat",
    description:
      "Get your free Vedic Kundli online — Lagna, Rashi, Nakshatra and Dasha. Chat with Arya, your AI astrologer, about marriage, career, love and money in Hindi, Marathi or English.",
  },
  hi: {
    title: "Jyotish — AI वैदिक ज्योतिषी | मुफ्त कुंडली और चैट",
    description:
      "अपनी मुफ्त वैदिक कुंडली पाएँ — लग्न, राशि, नक्षत्र और दशा। शादी, करियर, प्रेम और धन के सवाल हिंदी, मराठी या अंग्रेज़ी में आर्य से पूछें।",
  },
  mr: {
    title: "Jyotish — AI वैदिक ज्योतिषी | मोफत कुंडली आणि चॅट",
    description:
      "तुमची मोफत वैदिक कुंडली मिळवा — लग्न, राशी, नक्षत्र आणि दशा. लग्न, करिअर, प्रेम आणि पैशाचे प्रश्न हिंदी, मराठी किंवा इंग्रजीत आर्यला विचारा.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = titles[locale] ?? titles.en;
  return {
    title: t.title,
    description: t.description,
    alternates: alternatesFor(locale),
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Landing");
  const tt = await getTranslations("Today");
  const lt = await getTranslations("Footer");

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Jyotish",
    alternateName: "Hiarya",
    url: SITE_URL,
    description:
      "AI Vedic astrology chat — get your Kundli and personal answers on love, marriage, career, money and health.",
    inLanguage: [locale],
  };
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Jyotish",
    alternateName: ["Hiarya", "Arya"],
    url: SITE_URL,
    logo: `${SITE_URL}/icon.png`,
    description:
      "Jyotish (Hiarya) is an AI Vedic astrology app. Arya, an AI astrologer, reads your real Kundli and answers questions on love, marriage, career, money and health.",
  };
  const appJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Jyotish — AI Vedic Astrologer",
    alternateName: "Hiarya",
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Web",
    url: SITE_URL,
    inLanguage: ["en", "hi", "mr"],
    offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
  };

  // FAQPage structured data — targets "People also ask" (where is kundali,
  // what is a kundli, nakshatra 27, etc.) which the GSC data shows are the
  // real queries getting impressions but not clicks yet.
  const faqItems = [
    { q: t("faq1Q"), a: t("faq1A") },
    { q: t("faq2Q"), a: t("faq2A") },
    { q: t("faq3Q"), a: t("faq3A") },
    { q: t("faq4Q"), a: t("faq4A") },
    { q: t("faq5Q"), a: t("faq5A") },
    { q: t("faq6Q"), a: t("faq6A") },
  ];
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const steps = [
    { title: t("how1Title"), desc: t("how1Desc") },
    { title: t("how2Title"), desc: t("how2Desc") },
    { title: t("how3Title"), desc: t("how3Desc") },
  ];

  return (
    <div className="screen">
      {/* A returning user already has a chart on their profile — skip the
          birth-details form they have demonstrably completed once already. */}
      <ResumeGate mode="redirect" />
      <JsonLd data={websiteJsonLd} />
      <JsonLd data={orgJsonLd} />
      <JsonLd data={appJsonLd} />
      <JsonLd data={faqJsonLd} />
      <Header />

      <section className="hero">
        <NavagrahaMandala />
        <p className="hero__brand">{t("brand")}</p>
        <p className="hero__brand-tag">{t("brandTag")}</p>
        <span className="eyebrow">
          <span className="eyebrow__om">ॐ</span>
          {t("eyebrow")}
        </span>
        <h1 className="hero__title">
          {t("title")} <em>{t("titleHighlight")}</em>
        </h1>
        <p className="hero__sub">{t("subtitle")}</p>

        <div className="hero__cta">
          <Link href="/details" className="btn btn--gold btn--lg">
            {t("cta")}
          </Link>
          <span className="hero__cta-note">
            <span className="badge badge--live">●</span>
            {t("stats1Value")} · {t("stats1Label")}
          </span>
        </div>

        {/* tappable question chips — carry the question into the funnel */}
        <div className="hero-chips">
          {[t("chip1"), t("chip2"), t("chip3")].map((q) => (
            <Link
              key={q}
              href={{ pathname: "/details", query: { q } }}
              className="chip"
            >
              {q}
            </Link>
          ))}
        </div>

        {/* Supporting detail follows the action: on mobile, asking Arya stays
            visible without scrolling past explanatory copy or the preview. */}
        <p className="hero__purpose">{t("purpose")}</p>

        {/* sample Arya chat bubble — sets expectation it's a chat */}
        <div className="chat-preview">
          <span className="chat-preview__avatar">
            <Image src="/arays.png" alt="AI" fill sizes="40px" className="avatar-img" />
          </span>
          <div className="msg msg--ai">{t("sampleBubble")}</div>
        </div>
      </section>

      <section className="stats">
        <div className="stat">
          <span className="stat__value">{t("stats1Value")}</span>
          <span className="stat__label">{t("stats1Label")}</span>
        </div>
        <div className="stat">
          <span className="stat__value">{t("stats2Value")}</span>
          <span className="stat__label">{t("stats2Label")}</span>
        </div>
        <div className="stat">
          <span className="stat__value">{t("stats3Value")}</span>
          <span className="stat__label">{t("stats3Label")}</span>
        </div>
      </section>

      <Link href="/today" className="card reading-teaser">
        <span className="reading-teaser__icon">
          <Sun size={20} />
        </span>
        <span>
          <span className="reading-teaser__title">{tt("teaserTitle")}</span>
          <span className="reading-teaser__sub">{tt("teaserSub")}</span>
        </span>
        <ChevronRight size={20} className="reading-teaser__arrow" />
      </Link>

      <div className="persona">
        <span className="persona__avatar">
          <Image src="/arays.png" alt="AI" fill sizes="64px" className="avatar-img" />
        </span>
        <div className="persona__body">
          <span className="persona__name">{t("personaName")}</span>
          <span className="persona__meta">{t("personaMeta")}</span>
        </div>
        <span className="badge badge--ai">{t("aiBadge")}</span>
      </div>

      <section className="how">
        <h2 className="section-title">{t("howTitle")}</h2>
        <div className="how__list">
          {steps.map((s, i) => (
            <div className="how__item" key={i}>
              <span className="how__num">{i + 1}</span>
              <div>
                <div className="how__title">{s.title}</div>
                <div className="how__desc">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SEO content — real substance for Google to rank (kundli, nakshatra,
          vedic astrology, marriage timing long-tail queries). */}
      <section className="seo-content">
        <h2 className="section-title">{t("seoTitle")}</h2>
        <p className="seo-content__p">{t("seoIntro")}</p>
        <p className="seo-content__p">{t("seoBody1")}</p>
        <p className="seo-content__p">{t("seoBody2")}</p>
      </section>

      <section className="faq">
        <h2 className="section-title">{t("faqTitle")}</h2>
        <div className="faq__list">
          {faqItems.map((f) => (
            <details className="faq__item" key={f.q}>
              <summary className="faq__q">{f.q}</summary>
              <p className="faq__a">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Internal links into the guides. The blog ranks on page 1–2 but earns
          no clicks partly because nothing on the homepage points at it; this
          passes link equity and gives readers a next step. English only — the
          posts themselves are English. */}
      {locale === "en" && (
        <section className="seo-content">
          <h2 className="section-title">Vedic astrology guides</h2>
          <ul className="guide-links">
            {BLOG_POSTS.map((post) => (
              <li key={post.slug}>
                <Link href={`/blog/${post.slug}`}>{post.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <AppNav />

      <footer className="legal-links">
        <Link href="/legal/privacy" className="legal-links__item">{lt("privacy")}</Link>
        <span className="legal-links__dot">·</span>
        <Link href="/legal/terms" className="legal-links__item">{lt("terms")}</Link>
        <span className="legal-links__dot">·</span>
        <Link href="/blog" className="legal-links__item">Blog</Link>
        <span className="legal-links__dot">·</span>
        <Link href="/sitemap" className="legal-links__item">Sitemap</Link>
        <span className="legal-links__dot">·</span>
        <span className="legal-links__item faint">{t("stats2Value")} users</span>
        <span className="legal-links__dot">·</span>
        {/* Withdrawal has to be as easy as granting. */}
        <ConsentSettingsLink />
      </footer>
    </div>
  );
}
