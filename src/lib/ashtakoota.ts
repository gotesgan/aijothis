/**
 * Ashtakoota (guna milan) — the classic 36-guna compatibility scoring used in
 * Vedic marriage matching, computed from two people's Moon nakshatras + padas
 * and Moon rashis. Pure functions, no dependencies.
 *
 * Breakdown: Varna 1, Vashya 2, Tara 3, Yoni 4, Graha Maitri 5, Gana 6,
 * Bhakoot 7, Nadi 8 = 36.
 */

export interface MatchPerson {
  moonRashi: number; // 0-11
  moonNakshatra: number; // 0-26
  moonNakshatraPad: number; // 1-4
}

export interface MatchPart {
  key: string;
  label: string;
  gained: number;
  max: number;
  note: string;
}

export interface MatchScore {
  total: number;
  parts: MatchPart[];
  verdict: string;
}

/* ── Varna (1) — moon rashi → caste group ─────────────────────────── */
const VARNA_RASHI = [1, 3, 3, 0, 1, 3, 0, 0, 1, 3, 3, 0]; // Aries..Pisces
// 0=Brahmin 1=Kshatriya 2=Vaishya 3=Shudra. water=Brahmin, fire=Kshatriya,
// earth=Vaishya, air=Shudra.
const VARNA_NAME = ["Brahmin", "Kshatriya", "Vaishya", "Shudra"];

/* ── Nadi (8) — nakshatra → dosha group ───────────────────────────── */
const NADI_NAK = [
  0, 1, 2, 2, 1, 0, 0, 1, 2, 1, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2,
]; // 0=Vata 1=Pitta 2=Kapha
const NADI_NAME = ["Vata", "Pitta", "Kapha"];

/* ── Yoni (4) — nakshatra → animal ────────────────────────────────── */
const YONI_NAK = [
  "Horse", "Elephant", "Goat", "Serpent", "Serpent", "Dog", "Cat", "Goat", "Cat",
  "Rat", "Rat", "Cow", "Buffalo", "Tiger", "Buffalo", "Lion", "Deer", "Deer",
  "Dog", "Monkey", "Monkey", "Monkey", "Lion", "Horse", "Lion", "Cow", "Elephant",
];
// Classic natural enemies — same animal = friend (4), enemy = 0, else 1.
const YONI_ENEMY: Record<string, string[]> = {
  Horse: ["Buffalo", "Lion"],
  Elephant: ["Lion", "Tiger"],
  Goat: ["Dog", "Tiger"],
  Serpent: ["Mongoose", "Horse", "Lion"],
  Dog: ["Cat", "Goat", "Deer", "Monkey"],
  Cat: ["Dog", "Rat"],
  Rat: ["Cat", "Monkey", "Elephant"],
  Cow: ["Tiger", "Horse"],
  Buffalo: ["Horse", "Lion", "Tiger"],
  Tiger: ["Buffalo", "Elephant", "Cow", "Horse", "Goat", "Serpent"],
  Lion: ["Elephant", "Buffalo", "Horse", "Serpent", "Cow"],
  Deer: ["Dog", "Tiger"],
  Monkey: ["Dog", "Rat", "Serpent", "Tiger"],
};

/* ── Gana (6) — nakshatra → gana ──────────────────────────────────── */
const GANA_NAK = [
  0, 1, 2, 1, 0, 1, 0, 0, 2, 2, 1, 1, 0, 2, 0, 2, 0, 2, 2, 1, 1, 0, 2, 2, 1, 1, 0,
]; // 0=Deva 1=Manushya 2=Rakshasa
const GANA_NAME = ["Deva", "Manushya", "Rakshasa"];

/* ── Graha Maitri (5) — nakshatra → moon lord ─────────────────────── */
const LORD_NAK = [
  "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury",
  "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury",
  "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury",
];
// friendly planets per lord
const LORD_FRIENDS: Record<string, string[]> = {
  Sun: ["Moon", "Mars", "Jupiter"],
  Moon: ["Sun", "Mercury"],
  Mars: ["Sun", "Moon", "Jupiter"],
  Mercury: ["Sun", "Venus"],
  Jupiter: ["Sun", "Moon", "Mars"],
  Venus: ["Mercury", "Saturn"],
  Saturn: ["Mercury", "Venus"],
  Rahu: ["Venus", "Saturn", "Jupiter"],
  Ketu: ["Mars", "Jupiter", "Venus"],
};

/* ── Bhakoot (7) — moon rashi distance ────────────────────────────── */
const BHAKOOT_BAD = new Set([0, 2, 4, 6, 8, 12]);

/* ── Vashya (2) — moon rashi → group + control cycle ──────────────── */
const VASHYA_RASHI = [
  "Chatushpad", "Chatushpad", "Manav", "Keet", "Chatushpad", "Manav",
  "Manav", "Keet", "Chatushpad", "Chatushpad", "Manav", "Jalachar",
];
const VASHYA_CONTROLS: Record<string, string> = {
  Chatushpad: "Jalachar",
  Jalachar: "Keet",
  Keet: "Manav",
  Manav: "Chatushpad",
};

function tara(nBoy: number, nGirl: number): number {
  const diff = (nGirl - nBoy + 27) % 27; // 0..26
  const count = diff + 1; // 1-based
  return count % 9 === 3 || count % 9 === 5 || count % 9 === 7 ? 0 : 3;
}

function vashya(boyRashi: number, girlRashi: number): number {
  const b = VASHYA_RASHI[boyRashi];
  const g = VASHYA_RASHI[girlRashi];
  if (b === g) return 2;
  return VASHYA_CONTROLS[b] === g ? 2 : 0;
}

function grahaMaitri(boyNak: number, girlNak: number): number {
  const b = LORD_NAK[boyNak];
  const g = LORD_NAK[girlNak];
  if (b === g) return 5; // same moon lord — most compatible
  const bLikesG = LORD_FRIENDS[b]?.includes(g) ?? false;
  const gLikesB = LORD_FRIENDS[g]?.includes(b) ?? false;
  if (bLikesG && gLikesB) return 5;
  if (bLikesG || gLikesB) return 4;
  // both neutral or enemies → check mutual enemy
  const bDislikesG = LORD_FRIENDS[b] !== undefined && !bLikesG;
  const gDislikesB = LORD_FRIENDS[g] !== undefined && !gLikesB;
  return bDislikesG && gDislikesB ? 0 : 1;
}

function yoni(boyNak: number, girlNak: number): number {
  const b = YONI_NAK[boyNak];
  const g = YONI_NAK[girlNak];
  if (b === g) return 4;
  if (YONI_ENEMY[b]?.includes(g) || YONI_ENEMY[g]?.includes(b)) return 0;
  return 1;
}

function gana(boyNak: number, girlNak: number): number {
  const b = GANA_NAK[boyNak];
  const g = GANA_NAK[girlNak];
  if (b === g) return 6;
  if ((b === 0 && g === 1) || (b === 1 && g === 0)) return 5;
  if ((b === 0 && g === 2) || (b === 2 && g === 0)) return 1;
  return 0;
}

function bhakoot(boyRashi: number, girlRashi: number): number {
  const diff = (girlRashi - boyRashi + 12) % 12;
  return BHAKOOT_BAD.has(diff) ? 0 : 7;
}

function verdict(total: number): string {
  if (total >= 27) return "Excellent";
  if (total >= 21) return "Very good";
  if (total >= 15) return "Average";
  if (total >= 8) return "Low";
  return "Not recommended";
}

/** Full 36-guna Ashtakoota between a boy (groom) and a girl (bride). */
export function ashtakoota(boy: MatchPerson, girl: MatchPerson): MatchScore {
  const parts: MatchPart[] = [];

  const v = VARNA_RASHI[boy.moonRashi] <= VARNA_RASHI[girl.moonRashi] ? 1 : 0;
  parts.push({
    key: "varna",
    label: "Varna",
    gained: v,
    max: 1,
    note: `${VARNA_NAME[VARNA_RASHI[boy.moonRashi]]} × ${VARNA_NAME[VARNA_RASHI[girl.moonRashi]]}`,
  });

  const vsh = vashya(boy.moonRashi, girl.moonRashi);
  parts.push({
    key: "vashya",
    label: "Vashya",
    gained: vsh,
    max: 2,
    note: `${VASHYA_RASHI[boy.moonRashi]} × ${VASHYA_RASHI[girl.moonRashi]}`,
  });

  const tr = tara(boy.moonNakshatra, girl.moonNakshatra);
  parts.push({
    key: "tara",
    label: "Tara",
    gained: tr,
    max: 3,
    note: tr === 3 ? "Harmonious tara" : "Vipat/Pratyari/Vadha tara",
  });

  const yo = yoni(boy.moonNakshatra, girl.moonNakshatra);
  parts.push({
    key: "yoni",
    label: "Yoni",
    gained: yo,
    max: 4,
    note: `${YONI_NAK[boy.moonNakshatra]} × ${YONI_NAK[girl.moonNakshatra]}`,
  });

  const gm = grahaMaitri(boy.moonNakshatra, girl.moonNakshatra);
  parts.push({
    key: "grahaMaitri",
    label: "Graha Maitri",
    gained: gm,
    max: 5,
    note: `${LORD_NAK[boy.moonNakshatra]} × ${LORD_NAK[girl.moonNakshatra]} (moon lords)`,
  });

  const g = gana(boy.moonNakshatra, girl.moonNakshatra);
  parts.push({
    key: "gana",
    label: "Gana",
    gained: g,
    max: 6,
    note: `${GANA_NAME[GANA_NAK[boy.moonNakshatra]]} × ${GANA_NAME[GANA_NAK[girl.moonNakshatra]]}`,
  });

  const bh = bhakoot(boy.moonRashi, girl.moonRashi);
  parts.push({
    key: "bhakoot",
    label: "Bhakoot",
    gained: bh,
    max: 7,
    note: `Moon signs ${bh === 7 ? "in a compatible position" : "in a harmful position (2/4/6/8/12th)"}`,
  });

  const nd = NADI_NAK[boy.moonNakshatra] === NADI_NAK[girl.moonNakshatra] ? 0 : 8;
  parts.push({
    key: "nadi",
    label: "Nadi",
    gained: nd,
    max: 8,
    note: nd === 8 ? "Different nadi — good" : `Same nadi (${NADI_NAME[NADI_NAK[boy.moonNakshatra]]})`,
  });

  const total = parts.reduce((s, p) => s + p.gained, 0);
  return { total, parts, verdict: verdict(total) };
}
