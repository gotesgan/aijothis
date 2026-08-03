export type LegalLocale = "en" | "hi" | "mr";

export interface LegalSection {
  heading: string;
  body: string;
}

export interface LegalDoc {
  title: string;
  lastUpdated: string;
  intro: string;
  sections: LegalSection[];
}

export const PRIVACY: Record<LegalLocale, LegalDoc> = {
  en: {
    title: "Privacy Policy",
    lastUpdated: "Last updated: 3 Aug 2026",
    intro:
      "Jyotish respects your privacy. This policy explains what we collect, why we collect it, and how we protect it.",
    sections: [
      { heading: "What we collect", body: "Your name, birth date/time/place, mobile number (optional), your chat messages with Arya, a random device ID, and — only if you sign in with Google — your Google email and name." },
      { heading: "How we use it", body: "To generate your Vedic Kundli, give you personalised readings and chat replies, and to keep the service working. We never sell your data." },
      { heading: "Storage & security", body: "Data is stored securely (Supabase) with encryption in transit and database row-level security. Your birth details are sensitive — we treat them as confidential." },
      { heading: "Payments", body: "Payments (e.g. the question pack) are processed by Razorpay. We never see or store your card or UPI credentials." },
      { heading: "Your rights", body: "You can ask us to show or delete your data anytime. Contact us and we'll act within a reasonable time." },
      { heading: "Contact", body: "For privacy questions, contact us at support@aijothis.com." },
    ],
  },
  hi: {
    title: "गोपनीयता नीति",
    lastUpdated: "अंतिम अद्यतन: 3 अगस्त 2026",
    intro:
      "ज्योतिष आपकी गोपनीयता का सम्मान करता है। यह नीति बताती है कि हम क्या एकत्र करते हैं, क्यों, और उसे कैसे सुरक्षित रखते हैं।",
    sections: [
      { heading: "हम क्या एकत्र करते हैं", body: "आपका नाम, जन्म तिथि/समय/स्थान, मोबाइल नंबर (वैकल्पिक), आर्य से आपकी चैट, एक रैंडम device ID, और — केवल Google से login करने पर — आपका Google email और नाम।" },
      { heading: "हम इसका उपयोग कैसे करते हैं", body: "आपकी वैदिक कुंडली बनाने, व्यक्तिगत वाचन और चैट जवाब देने, और सेवा चालू रखने के लिए। हम आपका डेटा कभी नहीं बेचते।" },
      { heading: "भंडारण व सुरक्षा", body: "डेटा सुरक्षित रूप से (Supabase) संग्रहीत है — ट्रांज़िट में एन्क्रिप्टेड और डेटाबेस row-level security के साथ। आपकी जन्म जानकारी संवेदनशील है — हम उसे गोपनीय रखते हैं।" },
      { heading: "भुगतान", body: "भुगतान (जैसे question pack) Razorpay द्वारा संसाधित होता है। हम आपके कार्ड या UPI की जानकारी कभी नहीं देखते या संग्रहीत नहीं करते।" },
      { heading: "आपके अधिकार", body: "आप किसी भी समय अपना डेटा दिखाने या हटाने के लिए कह सकते हैं। संपर्क करें — हम उचित समय में कार्रवाई करेंगे।" },
      { heading: "संपर्क", body: "गोपनीयता संबंधी सवालों के लिए: support@aijothis.com।" },
    ],
  },
  mr: {
    title: "गोपनीयता धोरण",
    lastUpdated: "शेवटचे अपडेट: ३ ऑगस्ट २०२६",
    intro:
      "ज्योतिष तुमच्या गोपनीयतेचा आदर करतो. हे धोरण सांगते की आम्ही काय गोळा करतो, का, आणि ते कसे सुरक्षित ठेवतो.",
    sections: [
      { heading: "आम्ही काय गोळा करतो", body: "तुमचे नाव, जन्मतारीख/वेळ/ठिकाण, मोबाईल नंबर (ऐच्छिक), आर्यशी तुमचे संभाषण, एक रँडम device ID, आणि — फक्त Google ने login केल्यास — तुमचा Google email आणि नाव." },
      { heading: "आम्ही ते कसे वापरतो", body: "तुमची वैदिक कुंडली बनवण्यासाठी, वैयक्तिक वाचन आणि चॅट उत्तरे देण्यासाठी, आणि सेवा सुरू ठेवण्यासाठी. आम्ही तुमचा डेटा कधीही विकत नाही." },
      { heading: "साठवण व सुरक्षा", body: "डेटा सुरक्षितपणे (Supabase) साठवला आहे — ट्रान्झिटमध्ये एन्क्रिप्टेड आणि डेटाबेस row-level security सह. तुमची जन्म माहिती संवेदनशील आहे — आम्ही ती गोपनीय ठेवतो." },
      { heading: "पेमेंट", body: "पेमेंट (जसे question pack) Razorpay द्वारे प्रक्रिया केले जाते. आम्ही तुमचा कार्ड किंवा UPI तपशील कधीही पाहत नाही." },
      { heading: "तुमचे अधिकार", body: "तुम्ही कधीही तुमचा डेटा दाखवण्यासाठी किंवा हटवण्यासाठी विचारू शकता. संपर्क करा — आम्ही योग्य वेळेत कारवाई करू." },
      { heading: "संपर्क", body: "गोपनीयता प्रश्नांसाठी: support@aijothis.com." },
    ],
  },
};

export const TERMS: Record<LegalLocale, LegalDoc> = {
  en: {
    title: "Terms & Conditions",
    lastUpdated: "Last updated: 3 Aug 2026",
    intro:
      "By using Jyotish you agree to these terms. Please read them carefully.",
    sections: [
      { heading: "The service", body: "Jyotish provides AI-generated Vedic astrology guidance and a personal AI astrologer (Arya). It is for entertainment, self-reflection and personal insight — not a substitute for professional medical, legal, or financial advice." },
      { heading: "Accounts", body: "You may use the service without an account, or sign in with Google. You must be at least 13 years old. Your birth details should be accurate — we compute your chart from them." },
      { heading: "Payments & refunds", body: "Question packs are one-time purchases (e.g. ₹15 for 20 questions). Payments are processed by Razorpay. Refunds are available within 7 days if the questions remain unused." },
      { heading: "Acceptable use", body: "Don't misuse the service — no abusive content, attempts to harm the service, or unlawful use. We may suspend accounts that violate these terms." },
      { heading: "Disclaimer", body: "Astrology is interpretive, not guaranteed. Readings and chat replies reflect an AI interpretation of your chart and shouldn't be treated as factual predictions. Use your own judgement." },
      { heading: "Liability", body: "To the maximum extent permitted by law, Jyotish is not liable for decisions made based on readings. Our total liability is limited to the amount you paid for the service." },
      { heading: "Changes & contact", body: "We may update these terms. Continued use after changes means acceptance. Questions: support@aijothis.com." },
    ],
  },
  hi: {
    title: "नियम व शर्तें",
    lastUpdated: "अंतिम अद्यतन: 3 अगस्त 2026",
    intro: "ज्योतिष का उपयोग करने से आप इन नियमों से सहमत होते हैं। कृपया ध्यान से पढ़ें।",
    sections: [
      { heading: "सेवा", body: "ज्योतिष AI-जनित वैदिक ज्योतिष मार्गदर्शन और व्यक्तिगत AI ज्योतिषी (आर्य) प्रदान करता है। यह मनोरंजन और व्यक्तिगत सोच के लिए है — पेशेवर चिकित्सा, कानूनी या वित्तीय सलाह का विकल्प नहीं।" },
      { heading: "खाते", body: "आप बिना खाते के सेवा उपयोग कर सकते हैं, या Google से login कर सकते हैं। आयु कम से कम 13 वर्ष होनी चाहिए। जन्म विवरण सही होना चाहिए — हम उससे आपकी कुंडली बनाते हैं।" },
      { heading: "भुगतान व रिफंड", body: "Question packs एक बार की खरीद हैं (जैसे ₹15 में 20 questions)। भुगतान Razorpay द्वारा होता है। अनुपयोगी questions पर 7 दिनों में रिफंड उपलब्ध है।" },
      { heading: "उचित उपयोग", body: "सेवा का दुरुपयोग न करें — अपमानजनक सामग्री, सेवा को नुकसान, या गैरकानूनी उपयोग नहीं। नियम तोड़ने पर खाते निलंबित किए जा सकते हैं।" },
      { heading: "अस्वीकरण", body: "ज्योतिष व्याख्यात्मक है, गारंटीकृत नहीं। वाचन और चैट उत्तर आपकी कुंडली की AI व्याख्या हैं — तथ्यात्मक भविष्यवाणी नहीं। अपना विवेक उपयोग करें।" },
      { heading: "दायित्व", body: "कानून द्वारा अनुमत सीमा तक, वाचन के आधार पर लिए गए निर्णयों के लिए ज्योतिष जिम्मेदार नहीं है। हमारा कुल दायित्व आपके द्वारा भुगतान की गई राशि तक सीमित है।" },
      { heading: "बदलाव व संपर्क", body: "हम इन नियमों को अपडेट कर सकते हैं। बदलाव के बाद उपयोग का मतलब स्वीकृति है। सवाल: support@aijothis.com।" },
    ],
  },
  mr: {
    title: "अटी व शर्ती",
    lastUpdated: "शेवटचे अपडेट: ३ ऑगस्ट २०२६",
    intro: "ज्योतिष वापरल्याने तुम्ही या अटींना सहमत होता. कृपया काळजीपूर्वक वाचा.",
    sections: [
      { heading: "सेवा", body: "ज्योतिष AI-निर्मित वैदिक ज्योतिष मार्गदर्शन आणि वैयक्तिक AI ज्योतिषी (आर्य) देते. हे मनोरंजन आणि स्व-चिंतनासाठी आहे — व्यावसायिक वैद्यकीय, कायदेशीर किंवा आर्थिक सल्ल्याचा पर्याय नाही." },
      { heading: "खाती", body: "तुम्ही खात्याशिवाय सेवा वापरू शकता, किंवा Google ने login करू शकता. वय किमान १३ वर्षे असावे. जन्म माहिती अचूक असावी — आम्ही त्यावरून तुमची कुंडली बनवतो." },
      { heading: "पेमेंट व रिफंड", body: "Question packs एकदाची खरेदी आहेत (जसे ₹१५ मध्ये २० questions). पेमेंट Razorpay द्वारे होते. न वापरलेल्या questions वर ७ दिवसांत रिफंड उपलब्ध." },
      { heading: "योग्य वापर", body: "सेवेचा गैरवापर करू नका — आक्षेपार्ह सामग्री, सेवेचे नुकसान, किंवा बेकायदेशीर वापर नाही. नियम मोडल्यास खाती निलंबित होऊ शकतात." },
      { heading: "अस्वीकरण", body: "ज्योतिष व्याख्यात्मक आहे, हमी नाही. वाचन आणि चॅट उत्तरे तुमच्या कुंडलीचे AI व्याख्या आहेत — वस्तुस्थिती नव्हे. तुमचा विवेक वापरा." },
      { heading: "जबाबदारी", body: "कायद्याने परवानगी असलेल्या मर्यादेपर्यंत, वाचनावर आधारित निर्णयांसाठी ज्योतिष जबाबदार नाही. आमची एकूण जबाबदारी तुम्ही भरलेल्या रकमेपर्यंत मर्यादित." },
      { heading: "बदल व संपर्क", body: "आम्ही या अटी अपडेट करू शकतो. बदलानंतर वापर म्हणजे स्वीकृती. प्रश्न: support@aijothis.com." },
    ],
  },
};
