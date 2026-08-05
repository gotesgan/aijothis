"use client";

import { useEffect, useRef, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { geocodePlace, resolveTimezone, type GeocodeResult } from "@/lib/geocode";
import { Loader2, MapPin } from "lucide-react";

export interface PlaceSelection {
  place: string;
  lat: number;
  lng: number;
  timezone: string;
}

export function PlaceAutocomplete({
  label,
  placeholder,
  onSelect,
  onEdit,
}: {
  label: string;
  placeholder: string;
  onSelect: (place: PlaceSelection) => void;
  /** Called when the user edits the input after a place was chosen. */
  onEdit: () => void;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [googleFailed, setGoogleFailed] = useState(false);
  const [picked, setPicked] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSelectedRef = useRef("");

  /* ── Google Places autocomplete (when a key is configured) ── */
  useEffect(() => {
    if (!apiKey || !inputRef.current) return;

    setOptions({ key: apiKey, language: "en" });
    let disposed = false;

    // If Google doesn't come up quickly, fall back to Open-Meteo so the user
    // is never stuck unable to pick a place (the cause of the rage-click loop).
    const timeout = setTimeout(() => {
      if (!disposed) setGoogleFailed(true);
    }, 7000);

    importLibrary("places")
      .then(async (places) => {
        if (disposed || !inputRef.current) return;

        const autocomplete = new places.Autocomplete(
          inputRef.current,
          {
            types: ["(cities)"],
            fields: ["formatted_address", "geometry", "name"],
          }
        );

        autocomplete.addListener("place_changed", async () => {
          const place = autocomplete.getPlace();
          const lat = place.geometry?.location?.lat();
          const lng = place.geometry?.location?.lng();
          const address = place.formatted_address ?? place.name ?? "";
          if (lat == null || lng == null || !address) return;

          const timezone = await resolveTimezone(lat, lng);
          lastSelectedRef.current = address;
          setPicked(true);
          onSelect({ place: address, lat, lng, timezone });
        });
      })
      .catch(() => {
        // Google script failed → use the Open-Meteo fallback.
        if (!disposed) setGoogleFailed(true);
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      disposed = true;
      clearTimeout(timeout);
    };
  }, [apiKey, onSelect]);

  /* ── Open-Meteo fallback search (no Google key, or Google failed) ── */
  useEffect(() => {
    if (apiKey && !googleFailed) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 3) return;

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const res = await geocodePlace(query);
      setSuggestions(res);
      setSearching(false);
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, apiKey, googleFailed]);

  const showFallbackList = !apiKey || googleFailed;
  const showManual =
    query.trim().length >= 3 && !picked;

  async function pickManual(text: string) {
    const res = await geocodePlace(text);
    if (!res.length) return;
    onSelect({
      place: res[0].place,
      lat: res[0].lat,
      lng: res[0].lng,
      timezone: res[0].timezone,
    });
    lastSelectedRef.current = res[0].place;
    setQuery(res[0].place);
    setPicked(true);
    setSuggestions([]);
  }

  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <input
        ref={inputRef}
        className="field__input"
        type="text"
        placeholder={placeholder}
        value={showFallbackList ? query : undefined}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          // Clear a previously chosen place when the text is edited away.
          if (lastSelectedRef.current && next !== lastSelectedRef.current) {
            lastSelectedRef.current = "";
            setPicked(false);
            onEdit();
          }
        }}
      />

      {(showFallbackList || showManual) && (
        <div className="place-suggest">
          {showManual && (
            <button
              type="button"
              className="place-suggest__item"
              onClick={() => void pickManual(query.trim())}
            >
              <MapPin size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
              Use “{query.trim()}”
            </button>
          )}
          {showFallbackList && searching && (
            <span
              className="place-suggest__item faint"
              style={{ display: "flex", gap: 8, alignItems: "center" }}
            >
              <Loader2 size={14} className="spin" /> …
            </span>
          )}
          {showFallbackList &&
            suggestions.map((s, i) => (
              <button
                type="button"
                key={i}
                className="place-suggest__item"
                onClick={() => {
                  onSelect({
                    place: s.place,
                    lat: s.lat,
                    lng: s.lng,
                    timezone: s.timezone,
                  });
                  lastSelectedRef.current = s.place;
                  setQuery(s.place);
                  setPicked(true);
                  setSuggestions([]);
                }}
              >
                <MapPin size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                {s.place}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
