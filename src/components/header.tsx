import Image from "next/image";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "./language-switcher";

export function Header() {
  const t = useTranslations("App");

  return (
    <header className="app-header">
      <div className="app-header__brand">
        <Image
          src="/logo.png"
          alt={t("name")}
          className="app-header__logo-img"
          width={38}
          height={38}
        />
        <span className="app-header__name">
          {t("name")}
          <span className="dot">{t("nameSuffix")}</span>
        </span>
      </div>
      <span className="app-header__spacer" />
      <LanguageSwitcher />
    </header>
  );
}
