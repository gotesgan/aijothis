import type { Topic } from "./routing";

/**
 * Curated Vedic astrology knowledge base used for retrieval (RAG).
 * Each entry is authoritative, concise guidance that grounds Arya's
 * interpretations instead of relying on the model's vague memory.
 */

export interface VedicEntry {
  id: string;
  topics: Topic[];
  tags: string[]; // planet ids, `h1`..`h12`, `nak0`..`nak26`, dasha lord names
  content: string;
}

export const VEDIC_CORPUS: VedicEntry[] = [
  /* ── Nakshatras ─────────────────────────────────── */
  { id: "nak0", topics: ["general"], tags: ["nak0"], content: "Ashwini: ruled by the Ashwini Kumaras (divine healers). Swift, pioneering, healing energy. Favours initiative, medicine, speed and fresh beginnings; can be impulsive." },
  { id: "nak1", topics: ["general"], tags: ["nak1"], content: "Bharani: ruled by Yama. Disciplined, transformative, endures trials bravely. Good for deep work, handling responsibility and spiritual growth through challenge." },
  { id: "nak2", topics: ["career"], tags: ["nak2"], content: "Krittika: ruled by Agni. Sharp, purifying, cutting. Leadership and warrior energy; decisive action, bold careers (surgery, fire, governance). Can be blunt." },
  { id: "nak3", topics: ["general"], tags: ["nak3"], content: "Rohini: ruled by Prajapati. Creative, attractive, steady and fertile. Excellence in arts, beauty, wealth and comfortable growth; can be pleasure-loving." },
  { id: "nak4", topics: ["general"], tags: ["nak4"], content: "Mrigashira: ruled by Soma (the Moon). Curious, restless, seeks gently. Good for travel, research, adaptability and communication." },
  { id: "nak5", topics: ["general"], tags: ["nak5"], content: "Ardra: ruled by Rudra. Stormy, intense, transformative. Deep research, healing after crisis, technology; emotional highs and lows." },
  { id: "nak6", topics: ["general"], tags: ["nak6"], content: "Punarvasu: ruled by Aditi. Returns and renewals; fortunate, abundant. Good for home, recovery, second chances and prosperity." },
  { id: "nak7", topics: ["general"], tags: ["nak7"], content: "Pushya: ruled by Brihaspati (Jupiter). Nourishing, auspicious, guru-like. Excellent for blessings, stability, sacred rituals and giving guidance." },
  { id: "nak8", topics: ["general"], tags: ["nak8"], content: "Ashlesha: ruled by the Nagas. Intuitive, hypnotic, secretive. Strong in psychology, strategy, healing and uncovering hidden matters." },
  { id: "nak9", topics: ["career"], tags: ["nak9"], content: "Magha: ruled by the Pitris (ancestors). Royal, authoritative, legacy-focused. Leadership, respect, heritage and positions of power." },
  { id: "nak10", topics: ["love"], tags: ["nak10"], content: "Purva Phalguni: ruled by Bhaga. Creative, romantic, pleasure-loving. Arts, romance, comfort and enjoying life's sweetness." },
  { id: "nak11", topics: ["marriage"], tags: ["nak11"], content: "Uttara Phalguni: ruled by Aryaman. Steady, supportive, partnership-oriented. Commitment, generosity, marriage and long-lasting bonds." },
  { id: "nak12", topics: ["education"], tags: ["nak12"], content: "Hasta: ruled by Savitar. Skilled hands, craftsmanship, cleverness. Crafts, writing, detail work and precise professions." },
  { id: "nak13", topics: ["career"], tags: ["nak13"], content: "Chitra: ruled by Tvashtar (Vishwakarma). Brilliant, artistic, a designer. Architecture, design, strategy and creating beauty." },
  { id: "nak14", topics: ["career", "money"], tags: ["nak14"], content: "Swati: ruled by Vayu (wind). Independent, flexible, balanced. Trade, diplomacy, entrepreneurship and self-reliance." },
  { id: "nak15", topics: ["career"], tags: ["nak15"], content: "Vishakha: ruled by Indra-Agni. Ambitious, goal-driven, competitive. Achievement, competitive fields and reaching targets." },
  { id: "nak16", topics: ["marriage"], tags: ["nak16"], content: "Anuradha: ruled by Mitra. Devoted, friendly, persuasive. Strong in relationships, leadership and reconciliation." },
  { id: "nak17", topics: ["career"], tags: ["nak17"], content: "Jyeshtha: ruled by Indra. Senior, protective, commanding. Management, elder/authority roles; can be possessive." },
  { id: "nak18", topics: ["general"], tags: ["nak18"], content: "Mula: ruled by Nirriti. Deep research, roots, destruction-and-rebirth. Investigation, science, and unearthing hidden truths." },
  { id: "nak19", topics: ["general"], tags: ["nak19"], content: "Purva Ashadha: ruled by Apas (waters). Victorious, persuasive, uplifting. Communication, sales, motivation and conquering." },
  { id: "nak20", topics: ["general"], tags: ["nak20"], content: "Uttara Ashadha: ruled by the Vishvadevas. Enduring, ethical victory. Long-term goals, integrity and lasting achievement." },
  { id: "nak21", topics: ["education"], tags: ["nak21"], content: "Shravana: ruled by Vishnu. Learning, listening, travel. Education, media, communication and spiritual knowledge." },
  { id: "nak22", topics: ["money", "general"], tags: ["nak22"], content: "Dhanishta: ruled by the Vasus. Rhythmic, wealthy, musical. Music, medicine, finance and collective prosperity." },
  { id: "nak23", topics: ["general"], tags: ["nak23"], content: "Shatabhisha: ruled by Varuna. Healing, secret science, vast vision. Research, astrology, medicine and hidden knowledge." },
  { id: "nak24", topics: ["general"], tags: ["nak24"], content: "Purva Bhadrapada: ruled by Aja Ekapada. Intense, spiritual, transformative. Mystical work, healing and inner fire." },
  { id: "nak25", topics: ["general"], tags: ["nak25"], content: "Uttara Bhadrapada: ruled by Ahir Budhnya. Deep wisdom, calm, completion. Spirituality, gentle endings and final solutions." },
  { id: "nak26", topics: ["general"], tags: ["nak26"], content: "Revati: ruled by Pushan. Protective, nourishing, gentle. Caregiving, healing and safe journeys." },

  /* ── Planet karakas / significations ─────────────── */
  { id: "pl-sun", topics: ["career", "general"], tags: ["sun"], content: "Sun: soul, father, government, authority, vitality. Ruler of Leo; signifies the 1st (self), 4th (father-land) and 9th (fortune). Careers: government, leadership, medicine." },
  { id: "pl-moon", topics: ["love", "health", "general"], tags: ["moon"], content: "Moon: mind, emotions, mother, public, nurturance. Strong Moon = calm mind; afflicted Moon = anxiety, fluctuating moods. Careers: care, food, hospitality." },
  { id: "pl-mars", topics: ["career", "health"], tags: ["mars"], content: "Mars: courage, energy, siblings, competitions. Rules Aries & Scorpio; signifies 3rd (courage) and 6th (competition). Careers: engineering, sports, military, surgery." },
  { id: "pl-mercury", topics: ["education", "money", "career"], tags: ["mercury"], content: "Mercury: intellect, commerce, speech, analysis. Rules Gemini & Virgo; signifies 4th (learning) and 10th (karma). Careers: business, writing, data, trading." },
  { id: "pl-jupiter", topics: ["money", "education", "marriage", "general"], tags: ["jupiter"], content: "Jupiter: wisdom, wealth, dharma, blessings. Rules Sagittarius & Pisces; karaka for wealth, children and higher learning. Careers: teaching, finance, law, advisory." },
  { id: "pl-venus", topics: ["love", "marriage", "money"], tags: ["venus"], content: "Venus: love, marriage, beauty, luxury, harmony. Karaka for marriage and spouse. Rules Taurus & Libra; signifies 7th (partnership). Careers: arts, design, luxury." },
  { id: "pl-saturn", topics: ["career", "marriage", "health"], tags: ["saturn"], content: "Saturn: discipline, delay, service, endurance. Rules Capricorn & Aquarius; signifies 10th (karma) and 6th (service). Brings slow, lasting results; can delay marriage when afflicting the 7th." },
  { id: "pl-rahu", topics: ["career", "money", "general"], tags: ["rahu"], content: "Rahu: obsession, foreign matters, technology, unconventional paths. Amplifies desires and ambition. Careers: tech, research, foreign trade, media." },
  { id: "pl-ketu", topics: ["general"], tags: ["ketu"], content: "Ketu: detachment, spirituality, past karma, sharp insight. Brings sudden gains and losses, and a pull toward liberation and inner research." },

  /* ── Houses ─────────────────────────────────────── */
  { id: "h1", topics: ["general"], tags: ["h1"], content: "1st house (Lagna/Tanu): self, body, appearance, personality and overall vitality. Its lord and occupants shape the person's nature." },
  { id: "h2", topics: ["money", "general"], tags: ["h2"], content: "2nd house (Dhana): wealth, family, speech, food, accumulated assets. A strong 2nd and its lord give financial stability." },
  { id: "h3", topics: ["career", "general"], tags: ["h3"], content: "3rd house (Sahaja): courage, siblings, communication, self-effort and short journeys." },
  { id: "h4", topics: ["general"], tags: ["h4"], content: "4th house (Sukha): home, mother, peace of mind, property and vehicles. Moon and this house govern emotional security." },
  { id: "h5", topics: ["love", "education", "general"], tags: ["h5"], content: "5th house (Putra): romance, creativity, children, intelligence and mantras. Strong 5th favours love and learning." },
  { id: "h6", topics: ["health", "career"], tags: ["h6"], content: "6th house (Ripu): enemies, disease, debt, service and competition. Its strength shows ability to overcome challenges." },
  { id: "h7", topics: ["marriage", "love", "general"], tags: ["h7"], content: "7th house (Kalatra): marriage, spouse, partnership and public dealings. Its lord and Venus together indicate marriage quality and timing." },
  { id: "h8", topics: ["marriage", "health", "money", "general"], tags: ["h8"], content: "8th house (Ayu): longevity, transformation, inheritance, occult and sudden events. It can delay marriage or signal joint wealth and change." },
  { id: "h9", topics: ["education", "general"], tags: ["h9"], content: "9th house (Dharma): fortune, dharma, higher learning, father and the guru. A strong 9th is a great blessing for guidance and wisdom." },
  { id: "h10", topics: ["career", "general"], tags: ["h10"], content: "10th house (Karma): career, status, reputation and life's work. Its lord and Sun decide the profession's nature and success." },
  { id: "h11", topics: ["money", "career"], tags: ["h11"], content: "11th house (Labha): gains, income, friends and fulfilment of desires. Benefics here bring steady financial growth." },
  { id: "h12", topics: ["general"], tags: ["h12"], content: "12th house (Vyaya): losses, expenses, foreign lands, sleep and liberation. Good for foreign work and spiritual practice; drains energy otherwise." },

  /* ── Dasha ──────────────────────────────────────── */
  { id: "dasha-rule", topics: ["general"], tags: ["dasha", "ketu", "venus", "sun", "moon", "mars", "rahu", "jupiter", "saturn", "mercury"], content: "Dasha rule: the Mahadasha lord activates every house it occupies and rules. Benefic dasha lords on good houses bring growth; malefics bring lessons. Transit of the same planet over its natal position or key houses usually triggers the event." },
  { id: "dasha-saturn", topics: ["career", "general"], tags: ["saturn", "dasha"], content: "Saturn Mahadasha: a 19-year period of discipline, patience and slow-but-permanent results. Success through hard work, service and overcoming delay." },
  { id: "dasha-jupiter", topics: ["money", "education", "general"], tags: ["jupiter", "dasha"], content: "Jupiter Mahadasha (16 yrs): expansion, wisdom, wealth and blessings. Favourable for education, marriage, children and finances." },
  { id: "dasha-venus", topics: ["marriage", "love", "money", "general"], tags: ["venus", "dasha"], content: "Venus Mahadasha (20 yrs): romance, marriage, luxury and creative gains. A prime period for love and marriage matters." },
  { id: "dasha-mars", topics: ["career", "general"], tags: ["mars", "dasha"], content: "Mars Mahadasha (7 yrs): energy, action, ambition and competition. Good for career leaps and courage; avoid rash decisions." },
  { id: "dasha-mercury", topics: ["education", "money", "general"], tags: ["mercury", "dasha"], content: "Mercury Mahadasha (17 yrs): intellect, commerce, communication and learning. Favourable for business, studies and writing." },
  { id: "dasha-moon", topics: ["general"], tags: ["moon", "dasha"], content: "Moon Mahadasha (10 yrs): emotions, public life, mother and mind. Good for care-based careers and real estate." },
  { id: "dasha-sun", topics: ["career", "general"], tags: ["sun", "dasha"], content: "Sun Mahadasha (6 yrs): authority, government, recognition and vitality. A period for leadership and respect." },
  { id: "dasha-rahu", topics: ["career", "money", "general"], tags: ["rahu", "dasha"], content: "Rahu Mahadasha (18 yrs): ambition, foreign opportunities, technology and unconventional gains. Powerful but unpredictable; stay grounded." },
  { id: "dasha-ketu", topics: ["general"], tags: ["ketu", "dasha"], content: "Ketu Mahadasha (7 yrs): introspection, spirituality, detachment and sudden change. Good for inner research and clearing past karma." },

  /* ── Topic guidance ─────────────────────────────── */
  { id: "topic-marriage", topics: ["marriage"], tags: [], content: "Marriage timing: consider the 7th house, its lord, and Venus (karaka). Benefic Jupiter aspecting the 7th delays little; Saturn in or aspecting the 7th (or its lord) causes delay. Look to the Dasha of the 7th lord/Venus, and transits of Jupiter/Saturn over the 7th or 7th lord." },
  { id: "topic-mangal", topics: ["marriage"], tags: [], content: "Mangal Dosha: Mars placed in the 1st, 4th, 7th, 8th or 12th from the Lagna or Moon can cause friction/delay in marriage. Its cancellation by benefic placements softens it. Remedies: worship Hanuman, chant the Mangal mantra, or match with another Manglik." },
  { id: "topic-gunmilan", topics: ["marriage"], tags: [], content: "Gun Milan: the 36-point Ashtakoota match between two charts. Above 18 is acceptable, above 26 is excellent. Key kutas: Bhakoot (2nd/12th from Moon), Nadi (health/children), Varna, Vasya, Yoni, Gana, Rashi, Tara." },
  { id: "topic-career", topics: ["career"], tags: [], content: "Career guidance: judge the 10th house, its lord, and Sun (karaka). Saturn gives steady long-term success in service/technical fields; Rahu favours tech/foreign/unconventional careers; Jupiter suits teaching, finance and law." },
  { id: "topic-money", topics: ["money"], tags: [], content: "Wealth guidance: the 2nd house is accumulated wealth, the 11th is income and gains; Jupiter is the karaka for wealth. Strong 2nd/11th with benefics = steady growth. Transits of Jupiter and Saturn over the 2nd/11th mark financial peaks." },
  { id: "topic-health", topics: ["health"], tags: [], content: "Health guidance: the lagna shows vitality, the 6th shows disease, the 8th chronic/deep issues, and the Moon governs the mind. Afflicted Saturn/Mars/lagna can stress health. Advise care and remedies — never diagnose." },
  { id: "topic-education", topics: ["education"], tags: [], content: "Education guidance: the 4th is primary learning, the 5th intellect and memory, the 9th higher learning and luck in exams. Jupiter and Mercury are the karakas. Their Dasha/transit favours exams and admissions." },
  { id: "topic-love", topics: ["love"], tags: [], content: "Love guidance: the 5th house is romance and attraction, the 7th is commitment. Venus and Moon matter most. A strong 5th with a strong Venus favours smooth love; Saturn/Rahu can bring delay or unconventional bonds." },

  /* ── Remedies (light) ────────────────────────────── */
  { id: "remedy-gems", topics: ["general"], tags: [], content: "Gemstone correspondence (wear only after a competent astrologer confirms): Ruby=Sun, Pearl=Moon, Red Coral=Mars, Emerald=Mercury, Yellow Sapphire=Jupiter, Diamond=Venus, Blue Sapphire=Saturn. Gems strengthen the relevant planet when it is beneficial in the chart." },
  { id: "remedy-generic", topics: ["general"], tags: [], content: "Gentle universal remedies: chant the Gayatri or planetary beej mantras, feed the needy on the planet's day, and act with gratitude. Remedies calm the mind; they never substitute for wise practical action." },
];

export const NAKSHATRA_NAMES_RAG = [
  "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
  "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
  "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
  "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha",
  "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
];
