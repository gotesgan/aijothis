/**
 * Topic routing node.
 *
 * Classifies the user's question into a life area and returns the chart
 * factors that matter most for it, so Arya focuses on the right houses,
 * planets and Dashas instead of reading the whole chart every time.
 *
 * Keyword-based for now (instant, zero token cost, en/hi/mr). Swap
 * `classifyTopic` for an LLM classifier later if accuracy demands it —
 * the rest of the pipeline stays the same.
 */

export type Topic =
  | "love"
  | "marriage"
  | "career"
  | "money"
  | "health"
  | "education"
  | "general";

export interface ChartFocus {
  topic: Topic;
  houses: number[]; // key houses for this topic
  planetIds: string[]; // key planets (karakas) for this topic
  guidance: string; // instruction added to Arya's system prompt
}

const KEYWORDS: { topic: Exclude<Topic, "general">; words: string[] }[] = [
  {
    topic: "marriage",
    words: [
      "marriage", "married", "marry", "wedding", "shaadi", "vivah",
      "spouse", "husband", "wife", "pati", "patni", "milan", "matching",
      "engagement", "bandhan", "विवाह", "शादी", "पति", "पत्नी", "लग्न",
    ],
  },
  {
    topic: "love",
    words: [
      "love", "boyfriend", "girlfriend", "relationship", "romance",
      "breakup", "break-up", "break up", "crush", "प्रेम", "प्यार",
      "प्रेमी", "प्रेयसी",
    ],
  },
  {
    topic: "career",
    words: [
      "career", "job", "work", "business", "promotion", "profession",
      "switch", "boss", "company", "employment", "salary", "करियर",
      "नौकरी", "व्यवसाय", "काम",
    ],
  },
  {
    topic: "money",
    words: [
      "money", "wealth", "finance", "financial", "income", "profit",
      "property", "invest", "loan", "debt", "rich", "पैसा", "धन", "संपत्ति",
    ],
  },
  {
    topic: "health",
    words: [
      "health", "sickness", "illness", "disease", "body", "hospital",
      "heal", "स्वास्थ्य", "बीमारी", "रोग", "तबियत",
    ],
  },
  {
    topic: "education",
    words: [
      "education", "study", "exam", "admission", "degree", "college",
      "university", "learning", "पढ़ाई", "परीक्षा", "शिक्षा", "दाखिला",
    ],
  },
];

export function classifyTopic(question: string): Topic {
  const q = question.toLowerCase();
  for (const { topic, words } of KEYWORDS) {
    if (words.some((w) => q.includes(w))) return topic;
  }
  return "general";
}

export function getChartFocus(topic: Topic): ChartFocus {
  switch (topic) {
    case "love":
      return {
        topic,
        houses: [1, 5, 7],
        planetIds: ["venus", "moon", "mars", "mercury"],
        guidance:
          "Focus on romance, attraction and relationships. Emphasise the 5th house, Venus and the Moon. Keep the tone warm and light.",
      };
    case "marriage":
      return {
        topic,
        houses: [1, 2, 7, 8],
        planetIds: ["venus", "saturn", "jupiter", "moon"],
        guidance:
          "Focus on marriage timing and partnership. Weigh the 7th house, 7th lord, Venus (karaka) and any Saturn delay. Give approximate time windows.",
      };
    case "career":
      return {
        topic,
        houses: [1, 2, 6, 10, 11],
        planetIds: ["saturn", "sun", "mercury", "mars"],
        guidance:
          "Focus on career, profession and work. Weigh the 10th house, 10th lord, Sun (karaka), Saturn and the current Mahadasha. Give practical guidance and timing.",
      };
    case "money":
      return {
        topic,
        houses: [2, 5, 8, 11],
        planetIds: ["jupiter", "venus", "mercury", "saturn"],
        guidance:
          "Focus on wealth, income and financial gains. Weigh the 2nd and 11th houses, Jupiter (karaka for wealth) and current transits to the 2nd/11th. Be practical.",
      };
    case "health":
      return {
        topic,
        houses: [1, 6, 8, 12],
        planetIds: ["saturn", "mars", "moon", "sun"],
        guidance:
          "Focus on health and vitality. Weigh the lagna (1st house), 6th house and 8th house, and the condition of the Moon. Advise care and remedies, never diagnose.",
      };
    case "education":
      return {
        topic,
        houses: [4, 5, 9],
        planetIds: ["jupiter", "mercury", "moon"],
        guidance:
          "Focus on education and learning. Weigh the 4th, 5th and 9th houses, and Jupiter + Mercury (karakas for learning and intellect).",
      };
    default:
      return {
        topic: "general",
        houses: [],
        planetIds: [],
        guidance:
          "Give a well-rounded reading covering the main areas the user asks about, drawing on the whole chart.",
      };
  }
}

/** "1, 7, 8" → "1st, 7th, 8th" */
export function ordinalList(numbers: number[]): string {
  return numbers.map((n) => `${n}${ordinal(n)}`).join(", ");
}

function ordinal(n: number): string {
  if (n === 1) return "st";
  if (n === 2) return "nd";
  if (n === 3) return "rd";
  return "th";
}
