/**
 * Lightweight safety layer.
 * Hard guard for crisis/self-harm input (returns a caring reply without
 * calling the LLM), plus the model-level boundaries live in prompt.ts.
 */

const CRISIS_PATTERN =
  /(suicide|suicid\w*|kill myself|killing myself|end my life|ending my life|want to die|wanna die|no reason to live|don'?t want to live|hurt myself|self.?harm|take my life|आत्महत्या|जिंदगी खत्म|जीना नहीं|मरना चाह|मर जाऊं|आत्महत्या कर|मला जगायचं नाही|मरायचं आहे|जगू नये)/i;

export function detectCrisis(text: string): boolean {
  return CRISIS_PATTERN.test(text);
}

const CRISIS_REPLY: Record<string, string> = {
  en:
    "I'm really glad you told me that, and please know you're not alone. 🙏 I'm an AI, so I'm not equipped for crisis support — but the people around you and professional help can make a real difference. Please reach out to someone you trust or a mental-health professional right now. In India, you can call the KIRAN helpline (1800-599-0019) or iCall (9152987821) — both free, confidential, and available 24/7. You matter, and things can get better. ❤️",
  hi:
    "आपने यह मुझसे साझा किया, इसके लिए धन्यवाद — और कृपया जानें कि आप अकेले नहीं हैं। 🙏 मैं एक AI हूँ, इसलिए संकट सहायता के लिए सक्षम नहीं हूँ — लेकिन आपके आस-पास के लोग और पेशेवर मदद वाकई फर्क ला सकते हैं। कृपया अभी किसी भरोसेमंद व्यक्ति या मानसिक-स्वास्थ्य पेशेवर से संपर्क करें। भारत में आप KIRAN हेल्पलाइन (1800-599-0019) या iCall (9152987821) पर कॉल कर सकते हैं — दोनों मुफ्त और गोपनीय हैं। आपकी जिंदगी मायने रखती है, और चीज़ें बेहतर हो सकती हैं। ❤️",
  mr:
    "हे सांगितल्याबद्दल मला आनंद आहे, आणि कृपया जाणून घ्या तुम्ही एकटे नाहीत. 🙏 मी AI आहे, त्यामुळे संकट समर्थनासाठी सक्षम नाही — पण तुमच्या जवळचे लोक आणि व्यावसायिक मदत खरोखर फरक घडवू शकतात. कृपया लगेच विश्वासू व्यक्ती किंवा मानसिक-आरोग्य व्यावसायिकांशी संपर्क करा. भारतात तुम्ही KIRAN हेल्पलाइन (1800-599-0019) किंवा iCall (9152987821) वर कॉल करू शकता — दोन्ही विनामूल्य आणि गोपनीय. तुमचं आयुष्य महत्त्वाचं आहे, आणि गोष्टी सुधारू शकतात. ❤️",
};

export function crisisReply(lang: string): string {
  return CRISIS_REPLY[lang] ?? CRISIS_REPLY.en;
}
