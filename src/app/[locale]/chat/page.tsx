import { setRequestLocale } from "next-intl/server";
import { AryaChat } from "@/components/arya-chat";

export default async function ChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  const { q } = await searchParams;
  setRequestLocale(locale);

  return <AryaChat initialQ={q} />;
}
