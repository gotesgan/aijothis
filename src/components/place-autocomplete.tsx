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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSelectedRef = useRef("");

  /* ── Google Places autocomplete (when a key is configured) ── */
  useEffect(() => {
    if (!apiKey || !inputRef.current) return;

    setOptions({ key: apiKey, language: "en" });
    let disposed = false;

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
          onSelect({ place: address, lat, lng, timezone });
        });
      })
      .catch(() => {
        // Fall through to the Open-Meteo search if the Google script fails.
      });

    return () => {
      disposed = true;
    };
  }, [apiKey, onSelect]);

  /* ── Open-Meteo fallback search (no Google key) ── */
  useEffect(() => {
    if (apiKey) return;
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
  }, [query, apiKey]);

  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <input
        ref={inputRef}
        className="field__input"
        type="text"
        placeholder={placeholder}
        value={apiKey ? undefined : query}
        onChange={(e) => {
          const next = e.target.value;
          if (!apiKey) setQuery(next);
          // Clear a previously chosen place when the text is edited away.
          if (lastSelectedRef.current && next !== lastSelectedRef.current) {
            lastSelectedRef.current = "";
            onEdit();
          }
        }}
      />

      {!apiKey && (searching || suggestions.length > 0) && (
        <div className="place-suggest">
          {searching && (
            <span
              className="place-suggest__item faint"
              style={{ display: "flex", gap: 8, alignItems: "center" }}
            >
              <Loader2 size={14} className="spin" /> …
            </span>
          )}
          {suggestions.map((s, i) => (
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
