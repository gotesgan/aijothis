import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Header } from "@/components/header";
import { NavagrahaMandala } from "@/components/navagraha-mandala";
import { AppNav } from "@/components/app-nav";
import { Link } from "@/i18n/navigation";
import { Sun, ChevronRight } from "lucide-react";

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

  const steps = [
    { title: t("how1Title"), desc: t("how1Desc") },
    { title: t("how2Title"), desc: t("how2Desc") },
    { title: t("how3Title"), desc: t("how3Desc") },
  ];

  return (
    <div className="screen">
      <Header />

      <section className="hero">
        <NavagrahaMandala />
        <h1 className="hero__brand">{t("brand")}</h1>
        <p className="hero__brand-tag">{t("brandTag")}</p>
        <span className="eyebrow">
          <span className="eyebrow__om">ॐ</span>
          {t("eyebrow")}
        </span>
        <h2 className="hero__title">
          {t("title")} <em>{t("titleHighlight")}</em>
        </h2>
        <p className="hero__sub">{t("subtitle")}</p>
        <p className="hero__purpose">{t("purpose")}</p>

        {/* sample Arya chat bubble — sets expectation it's a chat */}
        <div className="chat-preview">
          <span className="chat-preview__avatar">
            <Image src="/arays.png" alt="AI" fill sizes="40px" className="avatar-img" />
          </span>
          <div className="msg msg--ai">{t("sampleBubble")}</div>
        </div>

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

      <AppNav />

      <footer className="legal-links">
        <Link href="/legal/privacy" className="legal-links__item">{lt("privacy")}</Link>
        <span className="legal-links__dot">·</span>
        <Link href="/legal/terms" className="legal-links__item">{lt("terms")}</Link>
        <span className="legal-links__dot">·</span>
        <span className="legal-links__item faint">{t("stats2Value")} users</span>
      </footer>
    </div>
  );
}
