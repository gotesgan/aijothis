/**
 * Detects when a user pastes a second person's birth details (like "naav -
 * Sarthak, janma tarik - 22/10/2003, sakali 7:30 am") so the chat can offer a
 * kundli-matching flow instead of forcing the model to guess.
 */

export interface MatchDetails {
  name: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm 24h
}

const DATE_RE = /(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{2,4})/;
const HOUR_MIN_RE = /(\d{1,2})\s*[:.]\s*(\d{2})\s*(am|pm|a\.m\.|p\.m\.|सकाळी|संध्याकाळी|subah|shaam|sakali|sandhya)?/i;
const HOUR_AP_RE = /(\d{1,2})\s*(am|pm|सकाळी|संध्याकाळी|subah|shaam|sakali)/i;
const NAME_RE = /(?:naav|name|naam|नाव|नाम)\s*[-:]\s*([A-Za-z\u0900-\u097F]{2,})/i;
const MATCH_HINT = /(match|compatib|guna|milan|kundli|लग्न|शादी|जोड़ी|जोडी|compatible|संगत|नातं|बरोबर)/i;

function to24h(h: number, ap?: string): number {
  const a = (ap ?? "").toLowerCase();
  if (a.startsWith("p") && h < 12) return h + 12;
  if (a.startsWith("a") && h === 12) return 0;
  return h;
}

/**
 * Best-effort parse of a second person's birth details from a chat message.
 * Returns null when no (non-own) birth date is present, or when there's no
 * name / match hint to confirm it's about someone else's chart.
 */
export function detectMatchRequest(
  text: string,
  ownBirthDate?: string
): MatchDetails | null {
  const dm = text.match(DATE_RE);
  if (!dm) return null;

  const d = Number(dm[1]);
  const m = Number(dm[2]);
  let y = Number(dm[3]);
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;

  const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  if (ownBirthDate && iso === ownBirthDate) return null;

  // Only treat as a match request when there's a name or an explicit hint.
  const nameMatch = text.match(NAME_RE);
  const name = nameMatch ? nameMatch[1] : "Partner";
  if (!nameMatch && !MATCH_HINT.test(text)) return null;

  let time = "";
  const hm = text.match(HOUR_MIN_RE);
  if (hm) {
    const h = to24h(Number(hm[1]), hm[3]);
    time = `${String(h).padStart(2, "0")}:${String(hm[2]).padStart(2, "0")}`;
  } else {
    const ha = text.match(HOUR_AP_RE);
    if (ha) {
      time = `${String(to24h(Number(ha[1]), ha[2])).padStart(2, "0")}:00`;
    }
  }

  return { name, date: iso, time };
}
