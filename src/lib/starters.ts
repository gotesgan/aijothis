import type { Locale } from "@/i18n/routing";

type Topic =
  | "marriage"
  | "career"
  | "money"
  | "health"
  | "education"
  | "travel"
  | "property";

interface Starter {
  topic: Topic;
  q: Record<Locale, string>;
}

/** Topic-tagged follow-up bank — the fallback trio mirrors the original chips. */
const BANK: Starter[] = [
  {
    topic: "marriage",
    q: {
      en: "What about marriage timing?",
      hi: "शादी की timing कैसी रहेगी?",
      mr: "लग्नाची timing कशी असेल?",
    },
  },
  {
    topic: "marriage",
    q: {
      en: "When will I meet my partner?",
      hi: "मेरे partner से मुलाकात कब होगी?",
      mr: "माझ्या partner ची भेट कधी होईल?",
    },
  },
  {
    topic: "marriage",
    q: {
      en: "Will my marriage be happy?",
      hi: "क्या मेरी शादी खुशहाल होगी?",
      mr: "माझं लग्न आनंदी असेल का?",
    },
  },
  {
    topic: "career",
    q: {
      en: "Tell me about my career",
      hi: "मेरे career के बारे में बताओ",
      mr: "माझ्या करिअरबद्दल सांगा",
    },
  },
  {
    topic: "career",
    q: {
      en: "When will I get a promotion?",
      hi: "मुझे promotion कब मिलेगा?",
      mr: "मला promotion कधी मिळेल?",
    },
  },
  {
    topic: "career",
    q: {
      en: "Should I start my own business?",
      hi: "क्या मुझे अपना business शुरू करना चाहिए?",
      mr: "मी माझा business सुरू करावा का?",
    },
  },
  {
    topic: "money",
    q: {
      en: "Is this good for money?",
      hi: "क्या यह money के लिए अच्छा है?",
      mr: "हे पैशासाठी चांगले आहे का?",
    },
  },
  {
    topic: "money",
    q: {
      en: "How can I improve my finances?",
      hi: "मैं अपनी finances कैसे improve करूँ?",
      mr: "मी माझी आर्थिक स्थिती कशी सुधारू?",
    },
  },
  {
    topic: "money",
    q: {
      en: "When will my salary increase?",
      hi: "मेरी salary कब बढ़ेगी?",
      mr: "माझी salary कधी वाढेल?",
    },
  },
  {
    topic: "health",
    q: {
      en: "What does my chart say about health?",
      hi: "मेरी health के बारे में chart क्या कहता है?",
      mr: "माझ्या आरोग्याबद्दल chart काय सांगतो?",
    },
  },
  {
    topic: "health",
    q: {
      en: "Will I have good health this year?",
      hi: "क्या इस साल मेरी health अच्छी रहेगी?",
      mr: "या वर्षी माझं आरोग्य चांगलं राहील का?",
    },
  },
  {
    topic: "education",
    q: {
      en: "Will I succeed in my studies?",
      hi: "क्या मैं अपनी पढ़ाई में सफल होऊँगा?",
      mr: "मी अभ्यासात यशस्वी होईन का?",
    },
  },
  {
    topic: "education",
    q: {
      en: "Which career suits my education?",
      hi: "मेरी पढ़ाई के लिए कौन सा career सही है?",
      mr: "माझ्या शिक्षणासाठी कोणते करिअर योग्य आहे?",
    },
  },
  {
    topic: "travel",
    q: {
      en: "Will I travel abroad soon?",
      hi: "क्या मैं जल्दी विदेश यात्रा करूँगा?",
      mr: "मी लवकरच परदेशी प्रवास करेन का?",
    },
  },
  {
    topic: "travel",
    q: {
      en: "Is now a good time for a trip?",
      hi: "क्या अभी trip के लिए अच्छा समय है?",
      mr: "आता प्रवासासाठी चांगली वेळ आहे का?",
    },
  },
  {
    topic: "property",
    q: {
      en: "Will I buy a house soon?",
      hi: "क्या मैं जल्दी घर खरीदूँगा?",
      mr: "मी लवकरच घर खरेदी करेन का?",
    },
  },
  {
    topic: "property",
    q: {
      en: "Is this a good time to invest in property?",
      hi: "क्या property में invest करने का अच्छा समय है?",
      mr: "मालमत्तेत गुंतवणूक करण्याची चांगली वेळ आहे का?",
    },
  },
];

/** Keywords (en/hi/mr mixed) used to score which topic is on the user's mind. */
const KEYWORDS: Record<Topic, string[]> = {
  marriage: [
    "marriage", "married", "wedding", "shadi", "shaadi", "लग्न", "शादी",
    "love", "प्रेम", "relationship", "partner", "husband", "wife",
    "boyfriend", "girlfriend", "रिश्ता", "संबंध", "भेट",
  ],
  career: [
    "career", "job", "promotion", "business", "office", "work",
    "नोकरी", "करिअर", "करियर", "काम", "प्रमोशन", "नौकरी", "व्यवसाय",
  ],
  money: [
    "money", "salary", "income", "finance", "wealth", "profit", "invest",
    "पैसा", "पैसे", "धन", "पगार", "सॅलरी", "संपत्ती", "आर्थिक",
  ],
  health: [
    "health", "आरोग्य", "बिमारी", "तबियत", "sick", "स्वास्थ्य", "रोग",
  ],
  education: [
    "study", "education", "exam", "college", "पढ़ाई", "परीक्षा",
    "अभ्यास", "शिक्षण", "पदवी",
  ],
  travel: [
    "travel", "trip", "abroad", "foreign", "journey", "प्रवास", "सफर",
    "विदेश", "परदेश",
  ],
  property: [
    "house", "home", "flat", "property", "घर", "संपत्ति", "संपत्ती", "building",
  ],
};

/**
 * Picks up to 3 follow-up questions that match the current conversation context.
 * `asked` (the user's questions so far) prevents repeating a question.
 * Topics with zero signal still fill empty slots (in keyword-map order), so the
 * no-context default is the classic marriage/career/money trio.
 */
export function pickStarters(
  context: string,
  locale: Locale,
  asked: Set<string>
): string[] {
  const text = context.toLowerCase();
  const scored: [Topic, number][] = (Object.keys(KEYWORDS) as Topic[]).map(
    (topic) => [
      topic,
      KEYWORDS[topic].reduce(
        (n, kw) => n + (text.includes(kw.toLowerCase()) ? 1 : 0),
        0
      ),
    ]
  );
  scored.sort((a, b) => b[1] - a[1]);

  const out: string[] = [];
  for (const [topic] of scored) {
    if (out.length >= 3) break;
    const q = BANK.find(
      (s) => s.topic === topic && !asked.has(s.q[locale])
    )?.q[locale];
    if (q && !out.includes(q)) out.push(q);
  }

  return out;
}
