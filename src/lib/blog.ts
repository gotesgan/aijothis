export interface BlogSection {
  heading: string; // phrased as a question — drives FAQ/featured-snippet capture
  paragraphs: string[];
}

export interface BlogFaq {
  q: string;
  a: string;
}

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  readingMinutes: number;
  sections: BlogSection[];
  faqs: BlogFaq[];
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "what-is-a-kundli",
    title: "What Is a Kundli (Birth Chart)? How to Read Yours",
    description:
      "A Kundli is a map of the planets at your exact birth moment. Learn what a Vedic birth chart shows — houses, rashis, nakshatras and dashas — and how to read yours.",
    date: "2026-08-07",
    readingMinutes: 6,
    sections: [
      {
        heading: "What exactly is a Kundli?",
        paragraphs: [
          "A Kundli (also called a Janma Kundali or birth chart) is a snapshot of the sky at the exact moment of your birth, drawn from the Vedic (sidereal) system. It plots the Sun, Moon and planets against the twelve zodiac signs (rashis) as seen from your birthplace, then divides the chart into twelve houses that represent areas of life — self, wealth, career, marriage, health and more.",
          "The key difference from Western astrology: Vedic astrology uses the fixed sidereal zodiac, corrected for the slow shift of the Earth's axis (ayanamsa). That is why your Vedic Moon sign and Sun sign can differ from the Western version of your chart.",
        ],
      },
      {
        heading: "What does your birth chart actually show?",
        paragraphs: [
          "Three things matter most when you start reading a Kundli. Your Lagna (ascendant) is the sign rising on the eastern horizon at birth — it sets your body, temperament and outer identity. Your Moon sign (Rashi) governs your mind and emotions, and your Moon nakshatra (one of 27 lunar mansions) colours your instincts and personality in fine detail. Your Mahadasha is the major planetary period you are living through right now — it explains why certain themes dominate a chapter of your life.",
          "Every planet sits in a house and a sign, and each planet also 'rules' one or two houses. Astrologers read these placements together: for example, a strong 10th house and its lord point toward career, while the 7th house and Venus describe marriage.",
        ],
      },
      {
        heading: "How do I get my Kundli?",
        paragraphs: [
          "You only need your date of birth, time of birth and birthplace. With those three details, the chart is computed precisely from astronomical data — no guessing. If you do not know your birth time, a chart can still be drawn at noon with a note that time-sensitive details like the ascendant stay approximate.",
          "On Jyotish you get your Kundli in seconds. Arya reads your real placements and answers in plain language — no jargon wall — about love, marriage, career, money and health, grounded in your actual chart.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is Vedic astrology different from Western astrology?",
        a: "Yes. Vedic astrology uses the sidereal zodiac (fixed against the stars), while Western astrology uses the tropical zodiac (fixed against the seasons). This shift means your signs can differ between the two systems.",
      },
      {
        q: "Do I need my exact birth time for a Kundli?",
        a: "It helps for precision — especially the ascendant — but it is not a blocker. If you do not know your time, a chart can still be generated at the standard noon default, with time-sensitive readings marked as approximate.",
      },
      {
        q: "What is the difference between Rashi and Nakshatra?",
        a: "Your Rashi is your Moon sign (one of 12). Your Nakshatra is one of 27 lunar mansions the Moon was passing through at birth — a finer, more personal layer that shapes instincts and compatibility.",
      },
    ],
  },
  {
    slug: "marriage-timing-vedic-astrology",
    title: "When Will I Get Married? Vedic Astrology Marriage Timing",
    description:
      "Marriage timing in Vedic astrology is read from the 7th house, Venus, Saturn and your current Dasha. Learn the real signals astrologers use — and the windows they can (and can't) predict.",
    date: "2026-08-07",
    readingMinutes: 7,
    sections: [
      {
        heading: "Which parts of the chart show marriage?",
        paragraphs: [
          "The 7th house is the house of marriage and partnership — its sign, lord and occupants matter most. Venus is the karaka (significator) for marriage and the spouse, and Jupiter is the karaka for the husband's chart in a woman's reading. The Moon adds emotional colour to how you bond.",
          "Saturn and Rahu deserve special attention: Saturn in or aspecting the 7th house (or its lord) is the classic cause of delay, while Rahu can bring unconventional or sudden relationships. Malefics in the 7th tend to postpone, not prevent.",
        ],
      },
      {
        heading: "How do astrologers time a marriage?",
        paragraphs: [
          "Timing is read from the Dasha sequence and transits together. Marriage is most likely when the Mahadasha or Antardasha of the 7th lord, Venus or Jupiter is running, and when Jupiter or Saturn transits the 7th house, its lord, or your natal Moon/Venus. A strong marriage Dasha meeting a supportive transit is the classic 'window'.",
          "Honest astrologers give windows, not dates. The chart shows the strongest season or year — for example 'around late 2027 to mid-2028' — but no birth chart legitimately yields a specific day.",
        ],
      },
      {
        heading: "What about Mangal Dosha and delay?",
        paragraphs: [
          "Mangal Dosha (Kuja Dosha) exists when Mars sits in the 1st, 4th, 7th, 8th or 12th house from the Lagna or Moon, and it can bring friction or delay in marriage. It is often cancelled by specific placements — a benefic aspect, Mars in its own sign, or a matching Manglik partner. Most experienced astrologers treat it as a caution, not a curse.",
          "If you are seeing delays, the productive question is not just 'when' but 'what strengthens my 7th house' — remedies, timing windows and being open to the right kind of partner usually matter more than a single placement.",
        ],
      },
    ],
    faqs: [
      {
        q: "Can astrology predict an exact marriage date?",
        a: "No. Responsible Vedic astrology gives windows — the strongest season or year — based on Dasha and transit cycles. Any astrologer promising an exact day is overstating the chart.",
      },
      {
        q: "Why does Saturn delay marriage in some charts?",
        a: "Saturn is the planet of delay, discipline and karma. When it sits in or aspects the 7th house or its lord, it tends to postpone marriage until the person is mature and stable — usually after the Saturn cycle resolves.",
      },
      {
        q: "How accurate is love-marriage vs arranged-marriage prediction?",
        a: "The chart shows tendencies, not certainties. A strong 5th house and Venus favour a love match; a strong 7th with family significators often points to an arranged path — but your choices and circumstances shape the final outcome.",
      },
    ],
  },
  {
    slug: "kundli-matching-36-gunas",
    title: "Kundli Matching: The 36 Gunas Explained",
    description:
      "Gun Milan is the 36-point compatibility score used before marriage in Indian astrology. Learn the 8 kutas, what a good score means, and how to read your own matching report.",
    date: "2026-08-07",
    readingMinutes: 7,
    sections: [
      {
        heading: "What is 36-guna Kundli matching?",
        paragraphs: [
          "Gun Milan (Ashtakoota) is a traditional compatibility score that compares the Moon signs and nakshatras of two people across eight categories, called kutas, for a total of 36 points. It was designed to assess harmony for marriage: temperament, health, emotional bond, sexual compatibility and longevity of the relationship.",
          "Each category carries a weight — for example Varna (spiritual compatibility) is worth 1 point, Bhakoot (emotional and family bond) is worth 7, and Nadi (health and children) is worth the maximum 8. The score tells you where the couple naturally harmonises and where the friction points will be.",
        ],
      },
      {
        heading: "What are the 8 kutas and their points?",
        paragraphs: [
          "The eight kutas are: Varna (1), Vashya (2), Tara (3), Yoni (4), Graha Maitri (5), Gana (6), Bhakoot (7) and Nadi (8). Tara checks destiny and fortune, Yoni covers instinct and attraction, Graha Maitri measures natural friendship between the Moon lords, and Gana looks at temperamental nature.",
          "A score of 18 or above out of 36 is traditionally considered acceptable, and 26+ is excellent. Very few couples score 36 — a handful of unavoidable points are routinely dropped in real readings.",
        ],
      },
      {
        heading: "How should you actually use the score?",
        paragraphs: [
          "Treat the number as a map, not a verdict. A low Nadi score flags health or child-related caution. A low Bhakoot signals emotional friction that needs conscious work. But a single weak kuta is routinely balanced by strong Dashas, matching Lagnas and the couple's own maturity.",
          "The best matching report reads the two full charts — not just the score. That is why the most useful answer to 'are we compatible?' combines the 36-guna total with the 7th-house and Venus placements of both people.",
        ],
      },
    ],
    faqs: [
      {
        q: "What is a good Kundli matching score?",
        a: "In the 36-point Ashtakoota system, 18+ is considered acceptable and 26+ is excellent. Scores below 18 prompt astrologers to examine which kutas are weak and whether they can be balanced.",
      },
      {
        q: "What does Nadi dosha mean in matching?",
        a: "Nadi is the highest-weighted kuta (8 points). When both partners share the same Nadi, it is considered a dosha (fault) traditionally linked to health or children — though many modern astrologers weigh it alongside the whole chart rather than rejecting the match outright.",
      },
      {
        q: "Can a low Guna score still be a good marriage?",
        a: "Yes. The score measures natural harmony across categories, not the fate of the marriage. Strong Dashas, compatible Lagnas and real-world effort regularly produce excellent marriages with average scores.",
      },
    ],
  },
  {
    slug: "muhurat-auspicious-timing",
    title: "Muhurat 101: Choosing an Auspicious Time",
    description:
      "A Muhurat is an auspicious time window for an important event. Learn how tithi, nakshatra, yoga and karana combine — and how to pick a good date for a wedding, housewarming or new start.",
    date: "2026-08-07",
    readingMinutes: 5,
    sections: [
      {
        heading: "What is a Muhurat?",
        paragraphs: [
          "A Muhurat is a chosen time window that is astrologically favourable for starting something important — a wedding, a new business, moving into a home, or a significant purchase. The idea is simple: timing matters, and some moments carry better planetary support than others.",
          "Panchang is the daily Vedic almanac that records the five moving elements of the day — tithi, vara (weekday), nakshatra, yoga and karana. Muhurat selection combines these five to find windows where the day's qualities support the event.",
        ],
      },
      {
        heading: "Which Panchang elements matter most?",
        paragraphs: [
          "Tithi is the lunar day — some tithis like Dwitiya and Panchami are considered auspicious for beginnings, while certain ones are avoided for weddings. Nakshatra is the Moon's mansion for the day, and each has its own nature: Pushya is excellent for rituals, Rohini for prosperity, Magha for authority. Yoga and karana add finer auspicious or inauspicious colour.",
          "You also avoid known obstacles: Rahu Kalam (the daily period ruled by Rahu), certain inauspicious tithis, and the 'gap' periods between karanas. A good Muhurat is the window where the favourable elements align and the obstacles fall outside it.",
        ],
      },
      {
        heading: "How do you find a Muhurat today?",
        paragraphs: [
          "For a daily question — 'is today good to start something?' — check the day's tithi, nakshatra, yoga and Rahu Kalam. Many good hours are simply the ones that avoid the bad windows.",
          "For a major event like a wedding, astrologers look for a specific set of auspicious tithis and nakshatras combined with a strong 7th house in the couple's charts. A reliable app or astrologer computes this from exact sunrise-based panchang data — not a guess.",
        ],
      },
    ],
    faqs: [
      {
        q: "What is Rahu Kalam?",
        a: "Rahu Kalam is a daily period ruled by Rahu, considered inauspicious for starting important work. Its timing shifts each weekday and is calculated from sunrise — most panchang apps list it automatically.",
      },
      {
        q: "Is a Muhurat required for a wedding?",
        a: "In traditional Indian weddings, yes — the muhurat time is fixed by the couple's charts and the panchang. But the guiding principle is choosing a window with strong support, not superstition.",
      },
      {
        q: "Which nakshatras are most auspicious for starting things?",
        a: "Pushya is famously auspicious for rituals and beginnings, Rohini for growth and prosperity, and Magha for authority and legacy. Swati and Chitra suit trade and design. The best choice depends on the event and the person's chart.",
      },
    ],
  },
  {
    slug: "27-nakshatras-guide",
    title: "The 27 Nakshatras: A Beginner's Guide",
    description:
      "Nakshatras are the 27 lunar mansions of Vedic astrology — the Moon's path divided into 27 stations. Learn what each nakshatra rules and how your birth nakshatra shapes you.",
    date: "2026-08-07",
    readingMinutes: 6,
    sections: [
      {
        heading: "What are the 27 Nakshatras?",
        paragraphs: [
          "The zodiac circle of 360 degrees is divided into 27 equal sections of 13 degrees 20 minutes, called nakshatras (lunar mansions). Because the Moon moves about one nakshatra per day, the nakshatra at your birth reveals the emotional and instinctive layer of your nature — finer than the Moon sign alone.",
          "Each nakshatra is ruled by one of the nine planets in a repeating cycle, and has a deity, a symbol and a temperament. Ashwini is fast and healing; Rohini is creative and magnetic; Mula is investigative and intense. Knowing your nakshatra also feeds into compatibility (Tara matching) and naming traditions.",
        ],
      },
      {
        heading: "What does your birth nakshatra say about you?",
        paragraphs: [
          "Your nakshatra colours how you react under pressure, what you crave and what drains you. For example, Pushya natives are natural nurturers and guides; Swati natives are independent, diplomatic traders of ideas; Uttara Bhadrapada natives carry deep, quiet wisdom and bring closure to things.",
          "The nakshatra also has four padas (quarters), which add further shading and are used in naming children and in finer prediction work. Reading nakshatra with the Moon sign gives a far more personal picture than either alone.",
        ],
      },
      {
        heading: "How do I find my nakshatra?",
        paragraphs: [
          "Find your Moon's exact degree at birth and divide by 13°20' — the whole number gives your nakshatra, the remainder your pada. Astrology apps do this instantly from your date, time and place.",
          "Once you know it, the practical use is twofold: it explains recurring patterns in your emotional life, and it powers compatibility matching (Tara and Nadi in the 36-guna system) with a partner.",
        ],
      },
    ],
    faqs: [
      {
        q: "How is a nakshatra calculated?",
        a: "It is the 13°20' segment of the zodiac the Moon occupied at your birth, measured in the sidereal system. Divide the Moon's longitude by 13°20' — the result is your nakshatra.",
      },
      {
        q: "Do nakshatras matter for compatibility?",
        a: "Yes. The 36-guna matching system uses nakshatra-based kutas — Tara (destiny), Yoni (attraction), Gana (nature) and Nadi (health) all come from the couple's nakshatras.",
      },
      {
        q: "Can two people share a nakshatra?",
        a: "Yes, and it is common. Sharing a nakshatra can mean similar instincts — often a deep understanding — but matching also weighs the Moon signs and full charts, not just one factor.",
      },
    ],
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
