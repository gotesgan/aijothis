export interface BirthDetails {
  name: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm 24h local
  place: string;
  lat: number;
  lng: number;
  timezone: string; // IANA tz id
  utcOffsetMinutes: number; // minutes east of UTC at birth moment
}

export interface PlanetPosition {
  id: string;
  symbol: string;
  name: string;
  longitude: number; // sidereal ecliptic longitude
  rashi: number; // 0-11
  degree: number; // within the sign (0-30)
  house: number; // 1-12 (whole sign)
  retrograde: boolean;
}

export interface DashaPeriod {
  lord: string;
  years: number;
  start: string; // ISO date
  end: string;
  current: boolean;
}

export interface KundliComputed {
  julianDay: number;
  ayanamsa: number;
  lagnaLongitude: number;
  lagnaRashi: number; // 0-11
  moonRashi: number;
  moonNakshatra: number; // 0-26
  moonNakshatraPad: number; // 1-4
  sunRashi: number;
  mcRashi: number;
}

export interface KundliResult {
  profile: {
    name: string;
    date: string;
    time: string;
    place: string;
    lat: number;
    lng: number;
    timezone: string;
  };
  computed: KundliComputed;
  planets: PlanetPosition[];
  dasha: {
    balanceYears: number;
    currentIndex: number;
    periods: DashaPeriod[];
  };
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
