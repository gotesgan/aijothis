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
            "radial-gradient(circle at 20% 20%, #242a3d 0%, #1b2030 55%, #121522 100%)",
          color: "#f7f3ea",
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
            color: "#c8b7ff",
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
            color: "#d0cdde",
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
            color: "#f7f3ea",
          }}
        >
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: 999,
              background: "#b8d8c2",
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
