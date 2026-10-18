import Image from "next/image";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./language-switcher";

export function Header() {
  const t = useTranslations("App");

  return (
    <header className="app-header">
      {/* The logo is the way home, as it is on any site. Home is `/`, which
          resolves to the chat for anyone who already has a chart, and to the
          landing page for someone new — so this is the same destination the
          Home tab promises, without a second rule to keep in sync. */}
      <Link href="/" className="app-header__brand" aria-label={t("name")}>
        <Image
          src="/logo.png"
          alt=""
          className="app-header__logo-img"
          width={38}
          height={38}
        />
        <span className="app-header__name">
          {t("name")}
          <span className="dot">{t("nameSuffix")}</span>
        </span>
      </Link>
      <span className="app-header__spacer" />
      <LanguageSwitcher />
    </header>
  );
}
