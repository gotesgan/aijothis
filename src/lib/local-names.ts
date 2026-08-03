import type { Locale } from "@/i18n/routing";

/* Localized Vedic terminology for the UI.
   Hindi & Marathi share the Sanskrit-derived names. */

export const RASHI: Record<Locale, string[]> = {
  en: [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
  ],
  hi: [
    "मेष", "वृषभ", "मिथुन", "कर्क", "सिंह", "कन्या",
    "तुला", "वृश्चिक", "धनु", "मकर", "कुंभ", "मीन",
  ],
  mr: [
    "मेष", "वृषभ", "मिथुन", "कर्क", "सिंह", "कन्या",
    "तुला", "वृश्चिक", "धनु", "मकर", "कुंभ", "मीन",
  ],
};

export const NAKSHATRA: Record<Locale, string[]> = {
  en: [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
    "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
    "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
    "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha",
    "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
  ],
  hi: [
    "अश्विनी", "भरणी", "कृत्तिका", "रोहिणी", "मृगशिरा", "आर्द्रा",
    "पुनर्वसु", "पुष्य", "आश्लेषा", "मघा", "पूर्वा फाल्गुनी", "उत्तरा फाल्गुनी",
    "हस्त", "चित्रा", "स्वाती", "विशाखा", "अनुराधा", "ज्येष्ठा",
    "मूल", "पूर्वाषाढा", "उत्तराषाढा", "श्रवण", "धनिष्ठा", "शतभिषा",
    "पूर्वा भाद्रपदा", "उत्तरा भाद्रपदा", "रेवती",
  ],
  mr: [
    "अश्विनी", "भरणी", "कृत्तिका", "रोहिणी", "मृगशिरा", "आर्द्रा",
    "पुनर्वसु", "पुष्य", "आश्लेषा", "मघा", "पूर्वा फाल्गुनी", "उत्तरा फाल्गुनी",
    "हस्त", "चित्रा", "स्वाती", "विशाखा", "अनुराधा", "ज्येष्ठा",
    "मूल", "पूर्वाषाढा", "उत्तराषाढा", "श्रवण", "धनिष्ठा", "शतभिषा",
    "पूर्वा भाद्रपदा", "उत्तरा भाद्रपदा", "रेवती",
  ],
};

/* planet id → localized name. Dasha lord names match these ids lowercased. */
export const PLANET: Record<Locale, Record<string, string>> = {
  en: {
    sun: "Sun", moon: "Moon", mars: "Mars", mercury: "Mercury",
    jupiter: "Jupiter", venus: "Venus", saturn: "Saturn",
    rahu: "Rahu", ketu: "Ketu",
  },
  hi: {
    sun: "सूर्य", moon: "चंद्र", mars: "मंगल", mercury: "बुध",
    jupiter: "बृहस्पति", venus: "शुक्र", saturn: "शनि",
    rahu: "राहु", ketu: "केतु",
  },
  mr: {
    sun: "सूर्य", moon: "चंद्र", mars: "मंगल", mercury: "बुध",
    jupiter: "बृहस्पति", venus: "शुक्र", saturn: "शनि",
    rahu: "राहु", ketu: "केतु",
  },
};
