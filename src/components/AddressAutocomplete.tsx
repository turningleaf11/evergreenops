// AddressAutocomplete — reusable address input backed by Google Places.
//
// Loads the Google Maps JS API on demand (singleton loader) and uses the
// Places Autocomplete service. Returns structured address parts to the
// caller on selection so we can split street / city / state / postal.
//
// Requires VITE_GOOGLE_MAPS_API_KEY in env. If the key is missing, the
// component degrades to a plain text input so the form still works.

import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface ParsedAddress {
  full: string;            // formatted_address from Google
  line1: string;           // street_number + route
  line2?: string;
  city?: string;
  state?: string;          // 2-letter state code
  postal_code?: string;
  country?: string;        // 2-letter country code
  lat?: number;
  lng?: number;
  place_id?: string;
}

interface Props {
  value: string;
  onChange: (text: string) => void;
  onSelect?: (address: ParsedAddress) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Restrict to a country (e.g. "us"). Default "us". */
  country?: string;
}

// ── Loader (singleton) ───────────────────────────────────────────────────────

declare global {
  interface Window {
    google?: any;
    __evergreenGmapsLoaderPromise?: Promise<any> | null;
  }
}

const GOOGLE_KEY = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

function loadGoogleMaps(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.maps?.places) return Promise.resolve(window.google);
  if (window.__evergreenGmapsLoaderPromise) return window.__evergreenGmapsLoaderPromise;
  if (!GOOGLE_KEY) return Promise.reject(new Error("VITE_GOOGLE_MAPS_API_KEY missing"));

  window.__evergreenGmapsLoaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_KEY)}&libraries=places&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = (e) => {
      window.__evergreenGmapsLoaderPromise = null;
      reject(e);
    };
    document.head.appendChild(script);
  });
  return window.__evergreenGmapsLoaderPromise;
}

// ── Component ────────────────────────────────────────────────────────────────

export function AddressAutocomplete({
  value, onChange, onSelect, placeholder = "Start typing an address…", disabled, className, country = "us",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionTokenRef = useRef<any>(null);
  const acService = useRef<any>(null);
  const placesService = useRef<any>(null);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [keyMissing] = useState(!GOOGLE_KEY);
  const [highlighted, setHighlighted] = useState(0);

  // Initialize Google services
  useEffect(() => {
    if (keyMissing) return;
    loadGoogleMaps()
      .then((g) => {
        acService.current = new g.maps.places.AutocompleteService();
        const placesDiv = document.createElement("div");
        placesService.current = new g.maps.places.PlacesService(placesDiv);
        sessionTokenRef.current = new g.maps.places.AutocompleteSessionToken();
      })
      .catch((e) => console.warn("[AddressAutocomplete] Google Maps load failed:", e));
  }, [keyMissing]);

  // Debounced query
  const fetchPredictions = useCallback((q: string) => {
    if (!acService.current || !q.trim()) { setPredictions([]); return; }
    setLoading(true);
    acService.current.getPlacePredictions(
      {
        input: q,
        sessionToken: sessionTokenRef.current,
        types: ["address"],
        componentRestrictions: { country },
      },
      (res: any[] | null) => {
        setLoading(false);
        setPredictions(res ?? []);
        setHighlighted(0);
      },
    );
  }, [country]);

  useEffect(() => {
    if (!value || keyMissing) { setPredictions([]); return; }
    const t = setTimeout(() => fetchPredictions(value), 200);
    return () => clearTimeout(t);
  }, [value, fetchPredictions, keyMissing]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!inputRef.current?.parentElement?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = (placeId: string, description: string) => {
    setOpen(false);
    onChange(description);
    if (!placesService.current || !onSelect) return;
    placesService.current.getDetails(
      {
        placeId,
        fields: ["address_components", "formatted_address", "geometry", "place_id"],
        sessionToken: sessionTokenRef.current,
      },
      (place: any, status: any) => {
        if (status !== "OK" || !place) return;
        const components = place.address_components ?? [];
        const findPart = (type: string, short = false) => {
          const c = components.find((c: any) => c.types.includes(type));
          return short ? c?.short_name : c?.long_name;
        };
        const streetNumber = findPart("street_number") || "";
        const route = findPart("route") || "";
        const line1 = [streetNumber, route].filter(Boolean).join(" ");
        const parsed: ParsedAddress = {
          full: place.formatted_address || description,
          line1: line1 || description,
          city: findPart("locality") || findPart("postal_town") || findPart("sublocality"),
          state: findPart("administrative_area_level_1", true),
          postal_code: findPart("postal_code"),
          country: findPart("country", true),
          lat: place.geometry?.location?.lat?.(),
          lng: place.geometry?.location?.lng?.(),
          place_id: place.place_id,
        };
        onChange(parsed.full);
        onSelect(parsed);
        // New session token after each selection (Google billing convention)
        if (window.google?.maps?.places) {
          sessionTokenRef.current = new window.google.maps.places.AutocompleteSessionToken();
        }
      },
    );
  };

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60 pointer-events-none" />
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!open || predictions.length === 0) return;
            if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted((h) => (h + 1) % predictions.length); }
            if (e.key === "ArrowUp")   { e.preventDefault(); setHighlighted((h) => (h - 1 + predictions.length) % predictions.length); }
            if (e.key === "Enter")     { e.preventDefault(); handleSelect(predictions[highlighted].place_id, predictions[highlighted].description); }
            if (e.key === "Escape")    setOpen(false);
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-8"
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && predictions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-lg border border-border bg-popover shadow-lg overflow-hidden max-h-72 overflow-y-auto">
          {predictions.map((p, i) => (
            <button
              key={p.place_id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleSelect(p.place_id, p.description); }}
              className={cn(
                "w-full text-left px-3 py-2 flex items-start gap-2.5 text-xs transition-colors",
                i === highlighted ? "bg-accent" : "hover:bg-accent/50",
              )}
            >
              <MapPin className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
              <span className="text-foreground">{p.description}</span>
            </button>
          ))}
        </div>
      )}

      {keyMissing && value && (
        <p className="text-[10px] text-muted-foreground/70 mt-1">
          Address autocomplete needs <code className="font-mono">VITE_GOOGLE_MAPS_API_KEY</code> in env. Plain text still works.
        </p>
      )}
    </div>
  );
}
