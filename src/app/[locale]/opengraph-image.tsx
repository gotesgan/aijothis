import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";

export const alt = `${SITE_NAME} — AI Vedic Astrologer`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Default social/OG share image for every page under /[locale]. Next.js picks
 * this up automatically, so every page gets a real 1200×630 preview without
 * each route having to declare one. Brand text stays Latin script so the image
 * never depends on a Devanagari font being available at render time.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background:
            "radial-gradient(circle at 20% 20%, #2a1b46 0%, #120d22 55%, #0d0a16 100%)",
          color: "#f6efe0",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 30,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "#ffb84d",
          }}
        >
          <span>ॐ</span>
          <span>AI-Powered Vedic Astrology</span>
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 96,
            fontWeight: 700,
            lineHeight: 1.05,
            display: "flex",
          }}
        >
          {SITE_NAME}
        </div>
        <div
          style={{
            marginTop: 20,
            fontSize: 40,
            color: "#d9cbb0",
            display: "flex",
          }}
        >
          Your Kundli, decoded by Arya.
        </div>
        <div
          style={{
            marginTop: 44,
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 30,
            color: "#f6efe0",
          }}
        >
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              background: "#4ade80",
              display: "flex",
            }}
          />
          <span>Free Kundli · Chat in English, हिंदी, मराठी</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
