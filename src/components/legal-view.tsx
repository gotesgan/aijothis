"use client";

import { useRouter } from "@/i18n/navigation";
import type { LegalDoc } from "@/lib/legal";
import { AppNav } from "@/components/app-nav";
import { ArrowLeft } from "lucide-react";

export function LegalView({ doc }: { doc: LegalDoc }) {
  const router = useRouter();

  return (
    <div className="screen">
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 0 10px" }}>
        <button className="faint" style={{ fontSize: 22 }} onClick={() => router.push("/")} aria-label="back">
          <ArrowLeft size={22} />
        </button>
        <h1 style={{ fontFamily: "var(--stack-display)", fontSize: 26, fontWeight: 600, lineHeight: 1.1 }}>
          {doc.title}
        </h1>
      </div>

      <p className="faint" style={{ fontSize: 12, marginBottom: 12 }}>{doc.lastUpdated}</p>
      <p className="muted" style={{ marginBottom: 18 }}>{doc.intro}</p>

      <div style={{ display: "grid", gap: 16 }}>
        {doc.sections.map((s, i) => (
          <section key={i}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{s.heading}</h2>
            <p className="muted" style={{ fontSize: 14, lineHeight: 1.7 }}>{s.body}</p>
          </section>
        ))}
      </div>

      <AppNav />
    </div>
  );
}
