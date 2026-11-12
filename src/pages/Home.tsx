import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BUSINESS } from "../config/business";
import { validateCustomer } from "../domain/customer";
import { calculateQuote, floorFee, type WaitingTime } from "../domain/pricing";
import { formatPickupTime, formatSchedule } from "../domain/schedule";
import { buildWhatsAppUrl, type WaStop } from "../domain/whatsapp";
import type { Helper, Service } from "../domain/types";
import { searchAddress, type GeocodeResult } from "../services/geocoding";
import { fetchRoute, type RouteResult } from "../services/routing";
import { track } from "../services/analytics";
import MapErrorBoundary from "../components/MapErrorBoundary";

const MapCanvas = lazy(() => import("../components/MapCanvas"));

type StopKind = "load" | "unload";

type Stop = {
  id: string;
  kind: StopKind;
  lat: number | null;
  lng: number | null;
  address: string;
};

type LatLng = { lat: number; lng: number };

type MapPoint = LatLng & { address: string };

type RoutePlan = {
  main: RouteResult[];
  garageToFirst: RouteResult | null;
  lastToGarage: RouteResult | null;
};

type RouteStatus = "idle" | "loading" | "ready" | "error";

const STOP_KIND_LABEL: Record<StopKind, string> = {
  load: "muat",
  unload: "bongkar",
};

function stopLabel(stop: Stop, stops: Stop[]): string {
  const sameKind = stops.filter((item) => item.kind === stop.kind);
  const index = sameKind.findIndex((item) => item.id === stop.id);
  return `${stop.kind === "load" ? "M" : "B"}${index + 1}`;
}

function straightLineKm(a: LatLng, b: LatLng): number {
  const kmPerDegree = 111.32;
  const midLat = (((a.lat + b.lat) / 2) * Math.PI) / 180;
  const dLat = (a.lat - b.lat) * kmPerDegree;
  const dLng = (a.lng - b.lng) * kmPerDegree * Math.cos(midLat);
  return Math.hypot(dLat, dLng);
}

type IconProps = {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
};

const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": true,
} as const;

function IconTruck({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps} width={size} height={size} className={className}>
      <path
        d="M3 7.5h10.5v8H3zM13.5 10.5h4.2l3.3 3.2v1.8h-7.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle
        cx="7"
        cy="17.5"
        r="1.8"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle
        cx="17.5"
        cy="17.5"
        r="1.8"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function IconPhone({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps} width={size} height={size} className={className}>
      <path
        d="M6.6 3.8h2.2l1 4-1.8 1.3a13.2 13.2 0 0 0 6.9 6.9l1.3-1.8 4 1v2.2a2.3 2.3 0 0 1-2.5 2.3C10.1 18.9 5.1 13.9 4.3 6.3A2.3 2.3 0 0 1 6.6 3.8Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconWhatsApp({ size = 20, className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

function IconInstagram({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps} width={size} height={size} className={className}>
      <rect
        x="3.5"
        y="3.5"
        width="17"
        height="17"
        rx="5"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" />
    </svg>
  );
}

function IconTikTok({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps} width={size} height={size} className={className}>
      <path
        d="M14.5 3.5v10.2a3.8 3.8 0 1 1-3.8-3.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.5 3.5c.4 2.7 2.1 4.4 4.6 4.7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconFacebook({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps} width={size} height={size} className={className}>
      <rect
        x="3.5"
        y="3.5"
        width="17"
        height="17"
        rx="4.5"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M13.7 20v-6.1h2.1l.3-2.4h-2.4V9.9c0-.7.2-1.2 1.2-1.2h1.3V6.6c-.2 0-1-.1-1.8-.1-1.8 0-3 1.1-3 3.1v1.9H9.3v2.4h2.1V20"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCheck({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps} width={size} height={size} className={className}>
      <path
        d="m5 12.5 4.2 4.2L19 6.8"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconMapPin({ size = 20, className, style }: IconProps) {
  return (
    <svg
      {...svgProps}
      width={size}
      height={size}
      className={className}
      style={style}
    >
      <path
        d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function IconSearch({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps} width={size} height={size} className={className}>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="m16 16 4 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconTarget({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps} width={size} height={size} className={className}>
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 2v3M12 19v3M2 12h3M19 12h3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconUser({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps} width={size} height={size} className={className}>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M4.8 20c.7-3.5 3.5-5.5 7.2-5.5s6.5 2 7.2 5.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconCalendar({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps} width={size} height={size} className={className}>
      <rect
        x="3.5"
        y="5"
        width="17"
        height="15.5"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M8 3v4M16 3v4M3.5 9.5h17"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconClock({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps} width={size} height={size} className={className}>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 7.5V12l3 2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBuilding({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps} width={size} height={size} className={className}>
      <path
        d="M4 20V6.5L12 3l8 3.5V20M2.5 20h19"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M8 20v-4.5h3V20M13 20v-8h3v8M8 8.5h.01M11 8.5h.01M14 8.5h.01M8 11.5h3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconRoute({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps} width={size} height={size} className={className}>
      <circle cx="6" cy="18" r="2.2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="18" cy="6" r="2.2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M8.2 18H14a4 4 0 0 0 0-8H9a3.5 3.5 0 0 1 0-7h6.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconBox({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps} width={size} height={size} className={className}>
      <path
        d="m12 3 8 4.2v9.6L12 21l-8-4.2V7.2L12 3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="m4.3 7.3 7.7 4 7.7-4M12 11.3V21"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconUsers({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps} width={size} height={size} className={className}>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M3 19c.5-3 2.7-4.8 6-4.8s5.5 1.8 6 4.8M16 5.2a3 3 0 0 1 0 5.6M18 14.4c1.9.5 3 1.9 3.4 4.1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMinus({ size = 18, className }: IconProps) {
  return (
    <svg {...svgProps} width={size} height={size} className={className}>
      <path
        d="M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconPlus({ size = 18, className }: IconProps) {
  return (
    <svg {...svgProps} width={size} height={size} className={className}>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconX({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps} width={size} height={size} className={className}>
      <path
        d="m6 6 12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconGrid({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps} width={size} height={size} className={className}>
      <rect
        x="4"
        y="4"
        width="7"
        height="7"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <rect
        x="13"
        y="4"
        width="7"
        height="7"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <rect
        x="4"
        y="13"
        width="7"
        height="7"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <rect
        x="13"
        y="13"
        width="7"
        height="7"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function IconAlert({ size = 18, className }: IconProps) {
  return (
    <svg {...svgProps} width={size} height={size} className={className}>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 7.5v5.2M12 16.2v.1"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconLock({ size = 16, className }: IconProps) {
  return (
    <svg {...svgProps} width={size} height={size} className={className}>
      <rect
        x="4.5"
        y="10"
        width="15"
        height="10"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M8 10V7.5a4 4 0 0 1 8 0V10"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconReceipt({ size = 20, className }: IconProps) {
  return (
    <svg {...svgProps} width={size} height={size} className={className}>
      <path
        d="M6 3h12v18l-3-1.8-3 1.8-3-1.8L6 21V3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M9 8h6M9 12h6M9 16h3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconArrowLeft({ size = 18, className }: IconProps) {
  return (
    <svg {...svgProps} width={size} height={size} className={className}>
      <path
        d="M19 12H5m0 0 6-6m-6 6 6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconArrowRight({ size = 18, className }: IconProps) {
  return (
    <svg {...svgProps} width={size} height={size} className={className}>
      <path
        d="M5 12h14m0 0-6-6m6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconArrowUp({ size = 18, className }: IconProps) {
  return (
    <svg {...svgProps} width={size} height={size} className={className}>
      <path
        d="M12 19V5m0 0-6 6m6-6 6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MapSearchControl({
  active,
  activeLabel,
  onSelect,
}: {
  active: StopKind;
  activeLabel: string;
  onSelect: (lat: number, lng: number, addr: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [status, setStatus] = useState<"idle" | "empty" | "error">("idle");
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setActiveIndex(-1);
      setStatus("idle");
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setStatus("idle");
      try {
        const found = await searchAddress(q, controller.signal);
        if (controller.signal.aborted) return;
        setResults(found);
        setActiveIndex(-1);
        setStatus(found.length > 0 ? "idle" : "empty");
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
          setStatus("error");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, retryTick]);

  function pick(result: GeocodeResult) {
    onSelect(result.lat, result.lon, result.display_name);
    setQuery(result.display_name);
    setResults([]);
    setActiveIndex(-1);
    setStatus("idle");
  }

  return (
    <div className="map-search">
      <div className="map-search-field">
        <IconSearch size={18} className="map-search-icon" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((index) =>
                Math.min(results.length - 1, index + 1),
              );
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => Math.max(0, index - 1));
              return;
            }
            if (event.key === "Enter") {
              const result = results[activeIndex] ?? results[0];
              if (result) {
                event.preventDefault();
                pick(result);
              }
            }
            if (event.key === "Escape") {
              setResults([]);
              setActiveIndex(-1);
            }
          }}
          placeholder={`Cari alamat titik ${activeLabel} (${STOP_KIND_LABEL[active]})...`}
          aria-label={`Cari alamat titik ${activeLabel} (${STOP_KIND_LABEL[active]})`}
          role="combobox"
          aria-autocomplete="list"
          aria-controls="map-search-results"
          aria-expanded={results.length > 0}
          aria-busy={loading}
          aria-describedby={status === "idle" ? undefined : "map-search-status"}
          aria-activedescendant={
            activeIndex >= 0 ? `map-result-${activeIndex}` : undefined
          }
        />
        {loading && (
          <span className="spinner" role="status" aria-label="Mencari alamat" />
        )}
      </div>
      {results.length > 0 && (
        <div
          className="map-search-results"
          id="map-search-results"
          role="listbox"
          aria-label="Hasil pencarian alamat"
        >
          {results.map((result, index) => (
            <button
              key={`${result.lat}-${result.lon}-${index}`}
              id={`map-result-${index}`}
              type="button"
              className={`map-result${index === activeIndex ? " is-active" : ""}`}
              role="option"
              aria-selected={index === activeIndex}
              tabIndex={-1}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => pick(result)}
            >
              <strong>{result.display_name.split(",")[0]}</strong>
              <span>{result.display_name}</span>
            </button>
          ))}
        </div>
      )}
      {status === "empty" && (
        <p className="map-search-note" id="map-search-status" role="status">
          Alamat tidak ditemukan. Coba kata kunci lain, ketuk peta, atau pakai
          lokasi saya.
        </p>
      )}
      {status === "error" && (
        <div
          className="map-search-note is-error"
          id="map-search-status"
          role="status"
        >
          <span>
            Pencarian alamat sedang tidak tersedia. Anda masih bisa mengetuk
            peta atau memakai lokasi saya.
          </span>
          <button
            type="button"
            onClick={() => setRetryTick((tick) => tick + 1)}
          >
            Coba lagi
          </button>
        </div>
      )}
    </div>
  );
}

function todayISO() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

interface TimeGroup {
  group: string;
  options: Array<{ value: string; label: string }>;
}

function buildTimeGroups(): TimeGroup[] {
  const groups: TimeGroup[] = [
    { group: "Pagi (06:00 - 10:45)", options: [] },
    { group: "Siang (11:00 - 14:45)", options: [] },
    { group: "Sore (15:00 - 17:45)", options: [] },
    { group: "Malam (18:00 - 22:00)", options: [] },
    { group: "Dini Hari & Subuh", options: [] },
  ];

  for (let h = 0; h < 24; h++) {
    const padH = String(h).padStart(2, "0");
    const minutes =
      h >= 6 && h <= 21 ? [0, 15, 30, 45] : h === 22 ? [0] : [0, 30];

    for (const m of minutes) {
      const padM = String(m).padStart(2, "0");
      const timeVal = `${padH}:${padM}`;
      const label = `${timeVal} WIB`;

      if (h >= 6 && h < 11) {
        groups[0].options.push({ value: timeVal, label });
      } else if (h >= 11 && h < 15) {
        groups[1].options.push({ value: timeVal, label });
      } else if (h >= 15 && h < 18) {
        groups[2].options.push({ value: timeVal, label });
      } else if (h >= 18 && h <= 22) {
        groups[3].options.push({ value: timeVal, label });
      } else {
        groups[4].options.push({ value: timeVal, label });
      }
    }
  }

  return groups;
}

const TIME_GROUPS = buildTimeGroups();

const TIME_PRESETS = [
  { time: "08:00", label: "08:00 (Pagi)" },
  { time: "10:00", label: "10:00" },
  { time: "13:00", label: "13:00 (Siang)" },
  { time: "16:00", label: "16:00 (Sore)" },
  { time: "19:00", label: "19:00 (Malam)" },
];

const QUICK_NOTES = [
  "Butuh terpal penutup",
  "Akses gang agak sempit",
  "Ada barang pecah belah / kaca",
  "Mohon bawa tali pengikat ekstra",
  "Ada tangga sempit / tinggi",
];

const GALLERY = [
  {
    base: "galeri-jasa-angkut-slamet-1",
    alt: "Dokumentasi armada Jasa Angkut Slamet",
    caption: "Armada Jasa Angkut Slamet",
    width: 1200,
    height: 1800,
  },
  {
    base: "galeri-jasa-angkut-slamet-2",
    alt: "Dokumentasi proses bongkar muat Jasa Angkut Slamet",
    caption: "Proses bongkar muat barang",
    width: 1200,
    height: 1600,
  },
  {
    base: "galeri-jasa-angkut-slamet-3",
    alt: "Dokumentasi layanan angkut barang Jasa Angkut Slamet",
    caption: "Layanan angkut barang",
    width: 1200,
    height: 1600,
  },
  {
    base: "galeri-jasa-angkut-slamet-4",
    alt: "Dokumentasi pengiriman barang Jasa Angkut Slamet",
    caption: "Pengiriman ke lokasi pelanggan",
    width: 1200,
    height: 1600,
  },
  {
    base: "galeri-jasa-angkut-slamet-5",
    alt: "Dokumentasi layanan pindahan Jasa Angkut Slamet",
    caption: "Bantuan pindahan rumah",
    width: 1200,
    height: 1600,
  },
  {
    base: "galeri-jasa-angkut-slamet-6",
    alt: "Dokumentasi muatan angkutan Jasa Angkut Slamet",
    caption: "Muatan tertata di bak armada",
    width: 1200,
    height: 1600,
  },
];

const SERVICE_AREAS = [
  {
    title: "Kabupaten Demak",
    description: "Termasuk Mranggen, Kebonbatur, Sayung, dan sekitarnya.",
    districts: [
      "Bonang",
      "Demak",
      "Dempet",
      "Gajah",
      "Guntur",
      "Karanganyar",
      "Karangawen",
      "Karangtengah",
      "Kebonagung",
      "Mijen",
      "Mranggen",
      "Sayung",
      "Wedung",
      "Wonosalam",
    ],
  },
  {
    title: "Kota Semarang",
    description: "Dari Semarang Tengah hingga Tugu, Ngaliyan, dan Tembalang.",
    districts: [
      "Banyumanik",
      "Candisari",
      "Gajahmungkur",
      "Gayamsari",
      "Genuk",
      "Gunungpati",
      "Mijen",
      "Ngaliyan",
      "Pedurungan",
      "Semarang Barat",
      "Semarang Selatan",
      "Semarang Tengah",
      "Semarang Timur",
      "Semarang Utara",
      "Tembalang",
      "Tugu",
    ],
  },
  {
    title: "Kabupaten Semarang",
    description: "Ungaran, Ambarawa, Bawen, Bandungan, dan sekitarnya.",
    districts: [
      "Ambarawa",
      "Bancak",
      "Bandungan",
      "Banyubiru",
      "Bawen",
      "Bergas",
      "Bringin",
      "Getasan",
      "Jambu",
      "Kaliwungu",
      "Pabelan",
      "Pringapus",
      "Sumowono",
      "Suruh",
      "Susukan",
      "Tengaran",
      "Tuntang",
      "Ungaran Barat",
      "Ungaran Timur",
    ],
  },
] as const;

const SECTION_IDS = [
  "beranda",
  "layanan",
  "cara-pesan",
  "kenapa",
  "galeri",
  "area-layanan",
  "faq",
  "hubungi",
  "kontak",
];

// Anchor yang tetap bisa dituju langsung (termasuk #pesan yang kini
// bersarang di dalam #beranda), meskipun tidak ikut scroll-spy.
const ANCHOR_IDS = [...SECTION_IDS, "pesan"];

const NAV_LINKS = [
  { id: "beranda", label: "Beranda", shortLabel: "Beranda" },
  { id: "layanan", label: "Layanan Kami", shortLabel: "Layanan" },
  { id: "galeri", label: "Galeri Armada", shortLabel: "Galeri" },
  { id: "area-layanan", label: "Area Layanan", shortLabel: "Area" },
  { id: "faq", label: "FAQ", shortLabel: "FAQ" },
] as const;

function getNavActiveKey(currentId: string): string {
  if (currentId === "pesan") return "beranda";
  if (currentId === "cara-pesan" || currentId === "kenapa") return "layanan";
  if (currentId === "hubungi" || currentId === "kontak") return "faq";
  return currentId;
}

function NavIcon({ id, size = 18 }: { id: string; size?: number }) {
  switch (id) {
    case "beranda":
      return <IconTruck size={size} />;
    case "layanan":
      return <IconBox size={size} />;
    case "pesan":
      return <IconMapPin size={size} />;
    case "galeri":
      return <IconGrid size={size} />;
    case "area-layanan":
      return <IconRoute size={size} />;
    case "faq":
      return <IconAlert size={size} />;
    default:
      return <IconPhone size={size} />;
  }
}

export default function Home() {
  const nextStopId = useRef(3);
  const analyticsStarted = useRef(false);
  const analyticsEstimate = useRef(false);
  const analyticsCompleted = useRef(false);
  const [stops, setStops] = useState<Stop[]>(() => [
    { id: "stop-1", kind: "load", lat: null, lng: null, address: "" },
    { id: "stop-2", kind: "unload", lat: null, lng: null, address: "" },
  ]);
  const [activeId, setActiveId] = useState("stop-1");
  const [floors, setFloors] = useState<Record<string, number>>({});
  const [fitTick, setFitTick] = useState(0);
  const [mapOpen, setMapOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [draft, setDraft] = useState<MapPoint | null>(null);
  const [locateStatus, setLocateStatus] = useState<{
    tone: "info" | "error";
    text: string;
  } | null>(null);
  const [mapBoundaryKey, setMapBoundaryKey] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [customerAttempted, setCustomerAttempted] = useState(false);
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [service, setService] = useState<Service>("dalam-kota");
  const [helper, setHelper] = useState<Helper>("none");
  const [waitingTime, setWaitingTime] = useState<WaitingTime>("none");
  const [note, setNote] = useState("");
  const [priority, setPriority] = useState(true);
  const [mapReadOnly, setMapReadOnly] = useState(false);

  const [step, setStep] = useState(1);
  const [stepDirection, setStepDirection] = useState<"forward" | "back">(
    "forward",
  );
  const [routeError, setRouteError] = useState(false);

  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [routeStatus, setRouteStatus] = useState<RouteStatus>("idle");

  const panelRef = useRef<HTMLElement | null>(null);
  const lastStepRef = useRef(1);
  const galleryTrackRef = useRef<HTMLUListElement | null>(null);
  const galleryTriggerRef = useRef<HTMLButtonElement | null>(null);
  const galleryModalRef = useRef<HTMLDivElement | null>(null);
  const mapTriggerRef = useRef<HTMLElement | null>(null);
  const mapModalRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLElement | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [activeNav, setActiveNav] = useState<string>(() => {
    if (typeof window !== "undefined" && window.location.hash) {
      const h = window.location.hash.replace("#", "");
      if (ANCHOR_IDS.includes(h)) return h;
    }
    return "beranda";
  });

  // Posisi anchor dihitung sendiri supaya selalu mendarat tepat di section
  // yang diklik: perpindahan jauh langsung diposisikan (tidak "berlari"
  // melewati section lain), perpindahan dekat tetap dianimasikan halus.
  const navRafRef = useRef(0);
  const navSyncSuppressUntilRef = useRef(0);

  const cancelNavScroll = useCallback(() => {
    if (navRafRef.current) {
      window.cancelAnimationFrame(navRafRef.current);
      navRafRef.current = 0;
      document.documentElement.style.scrollBehavior = "";
    }
  }, []);

  const scrollToAnchor = useCallback(
    (id: string) => {
      const el = document.getElementById(id);
      if (!el) return;

      cancelNavScroll();
      navSyncSuppressUntilRef.current = 0;

      const header = document.querySelector<HTMLElement>(".site-header");
      const headerHeight = header?.getBoundingClientRect().height ?? 0;
      const scrollMargin =
        Number.parseFloat(window.getComputedStyle(el).scrollMarginTop) || 0;
      const offset = Math.max(scrollMargin, headerHeight + 16);
      const maxTop = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const targetTop = Math.min(
        Math.max(el.getBoundingClientRect().top + window.scrollY - offset, 0),
        maxTop,
      );
      const startTop = window.scrollY;
      const distance = targetTop - startTop;

      const finish = () => {
        navRafRef.current = 0;
        // `window.scrollTo` menempel persis ke target, tanpa sisa animasi.
        window.scrollTo(0, targetTop);
        document.documentElement.style.scrollBehavior = "";
        setActiveNav(id);
        if (window.location.hash !== `#${id}`) {
          window.history.replaceState(null, "", `#${id}`);
        }
      };

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const animate =
        !reduceMotion &&
        Math.abs(distance) > 2 &&
        Math.abs(distance) <= window.innerHeight * 1.25;

      if (!animate) {
        // Lompatan jauh: langsung ke tujuan agar tidak terlihat melewati
        // section-section di antaranya.
        document.documentElement.style.scrollBehavior = "auto";
        finish();
        return;
      }

      const duration = Math.min(520, Math.max(240, Math.abs(distance) * 0.5));
      const startedAt = performance.now();
      // Blokir sinkronisasi section/hash selama animasi berjalan.
      navSyncSuppressUntilRef.current = startedAt + duration + 250;
      document.documentElement.style.scrollBehavior = "auto";

      const step = (now: number) => {
        const progress = Math.min(1, Math.max(0, (now - startedAt) / duration));
        const eased =
          progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;
        window.scrollTo(0, startTop + distance * eased);
        if (progress < 1) {
          navRafRef.current = window.requestAnimationFrame(step);
          return;
        }
        finish();
        navSyncSuppressUntilRef.current = performance.now() + 120;
      };

      navRafRef.current = window.requestAnimationFrame(step);
    },
    [cancelNavScroll],
  );

  // Semua tautan anchor memakai animasi yang sama, termasuk tautan footer/CTA.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target as Element | null;
      const anchor = target?.closest?.('a[href^="#"]');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.classList.contains("skip-link")) return;
      const href = anchor.getAttribute("href");
      if (!href || href === "#") return;
      const id = href.slice(1);
      if (!document.getElementById(id)) return;

      event.preventDefault();
      setMenuOpen(false);
      setActiveNav(id);
      if (window.location.hash !== `#${id}`) {
        window.history.pushState(null, "", `#${id}`);
      }
      scrollToAnchor(id);
    }

    function onInterrupt() {
      if (!navRafRef.current) return;
      cancelNavScroll();
      // Biarkan sinkronisasi section kembali normal untuk scroll manual.
      navSyncSuppressUntilRef.current = 0;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (
        ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(
          event.key,
        )
      ) {
        onInterrupt();
      }
    }

    document.addEventListener("click", onClick);
    window.addEventListener("wheel", onInterrupt, { passive: true });
    window.addEventListener("touchstart", onInterrupt, { passive: true });
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("wheel", onInterrupt);
      window.removeEventListener("touchstart", onInterrupt);
      window.removeEventListener("keydown", onKeyDown);
      cancelNavScroll();
    };
  }, [cancelNavScroll, scrollToAnchor]);

  useEffect(() => {
    const sectionIds = SECTION_IDS;
    let ticking = false;
    let settleTimer = 0;

    function detectSection(): string {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const fullHeight = document.documentElement.scrollHeight;

      // Jika scroll sudah di dasar halaman (mentok bawah) -> pasti kontak
      if (windowHeight + scrollY >= fullHeight - 120) {
        return "kontak";
      }

      // Deteksi berdasarkan getBoundingClientRect
      const headerThreshold = 180;
      let matched = "beranda";

      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= headerThreshold) {
            matched = id;
          }
        }
      }
      return matched;
    }

    function syncSection() {
      const current = detectSection();
      setActiveNav((prev) => (prev === current ? prev : current));
      if (window.location.hash !== `#${current}`) {
        window.history.replaceState(null, "", `#${current}`);
      }
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        ticking = false;
        setShowScrollTop(window.scrollY > 480);
        // Selama animasi anchor berjalan, jangan sentuh section aktif/hash
        // supaya penanda tidak melompati section perantara.
        if (performance.now() < navSyncSuppressUntilRef.current) return;
        // Perbarui section aktif setelah scroll berhenti.
        window.clearTimeout(settleTimer);
        settleTimer = window.setTimeout(syncSection, 150);
      });
    }

    function onHashChange() {
      const h = window.location.hash.replace("#", "");
      if (ANCHOR_IDS.includes(h)) {
        setActiveNav(h);
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("hashchange", onHashChange);

    setShowScrollTop(window.scrollY > 480);

    return () => {
      window.clearTimeout(settleTimer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (
        menuRef.current?.contains(target) ||
        menuButtonRef.current?.contains(target)
      ) {
        return;
      }
      setMenuOpen(false);
    };
    const desktopQuery = window.matchMedia("(min-width: 960px)");
    const onDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setMenuOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    desktopQuery.addEventListener("change", onDesktop);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      desktopQuery.removeEventListener("change", onDesktop);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (lastStepRef.current === step) return;
    lastStepRef.current = step;
    document
      .getElementById("wizard-step-title")
      ?.focus({ preventScroll: true });
  }, [step]);

  function scrollGalleryTo(index: number) {
    const track = galleryTrackRef.current;
    if (!track) return;
    const total = GALLERY.length;
    const wrapped = ((index % total) + total) % total;
    track.scrollTo({
      left: wrapped * track.clientWidth,
      behavior: wrapped === index ? "smooth" : ("instant" as ScrollBehavior),
    });
    setGalleryIndex(wrapped);
  }

  function handleGalleryScroll() {
    const track = galleryTrackRef.current;
    if (!track || track.clientWidth === 0) return;
    const nextIndex = Math.round(track.scrollLeft / track.clientWidth);
    setGalleryIndex(Math.max(0, Math.min(GALLERY.length - 1, nextIndex)));
  }

  function handleGalleryKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollGalleryTo(galleryIndex - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollGalleryTo(galleryIndex + 1);
    }
  }

  useEffect(() => {
    if (!mapOpen) return;
    const dialog = mapModalRef.current;
    const getFocusable = () =>
      dialog
        ? Array.from(
            dialog.querySelectorAll<HTMLElement>(
              "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
            ),
          )
        : [];

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMapOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = getFocusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (mapTriggerRef.current?.isConnected) {
        mapTriggerRef.current.focus();
      }
    };
  }, [mapOpen]);

  useEffect(() => {
    if (!bookingOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setBookingOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [bookingOpen]);

  useEffect(() => {
    if (window.location.hash === "#pesan") {
      setBookingOpen(true);
    }
    const onHashChange = () => {
      if (window.location.hash === "#pesan") setBookingOpen(true);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest<HTMLAnchorElement>("a");
      if (!anchor) return;
      if (anchor.getAttribute("href") !== "#pesan") return;
      event.preventDefault();
      setBookingOpen(true);
      if (window.location.hash !== "#pesan") {
        history.replaceState(
          null,
          "",
          `${window.location.pathname}${window.location.search}#pesan`,
        );
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (!galleryOpen) return;
    const dialog = galleryModalRef.current;
    const getFocusable = () =>
      dialog
        ? Array.from(
            dialog.querySelectorAll<HTMLElement>(
              "a[href], button:not([disabled])",
            ),
          )
        : [];
    getFocusable()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setGalleryOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = getFocusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    const trigger = galleryTriggerRef.current;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [galleryOpen]);

  const today = useMemo(todayISO, []);
  const customerCheck = useMemo(
    () => validateCustomer({ name, phone }),
    [name, phone],
  );
  const nameError = customerAttempted && customerCheck.nameMissing;
  const phoneError =
    customerCheck.phoneInvalid && (phone.trim() !== "" || customerAttempted);
  const waChatUrl = `https://wa.me/${BUSINESS.whatsapp}`;

  const loadStops = useMemo(
    () => stops.filter((stop) => stop.kind === "load"),
    [stops],
  );
  const unloadStops = useMemo(
    () => stops.filter((stop) => stop.kind === "unload"),
    [stops],
  );
  const orderedStops = useMemo(
    () => [...loadStops, ...unloadStops],
    [loadStops, unloadStops],
  );
  const activeStop = stops.find((stop) => stop.id === activeId) ?? stops[0];
  const floorOf = (id: string) => floors[id] ?? 1;
  const allStopsSet =
    loadStops.length > 0 &&
    unloadStops.length > 0 &&
    stops.every((stop) => stop.lat !== null && stop.lng !== null);

  const routePoints = useMemo(
    () =>
      orderedStops
        .filter((stop) => stop.lat !== null && stop.lng !== null)
        .map((stop) => ({ lat: stop.lat as number, lng: stop.lng as number })),
    [orderedStops],
  );
  const routeKey = routePoints
    .map((point) => `${point.lat},${point.lng}`)
    .join("|");
  const garagePoint = useMemo(
    () => ({ lat: BUSINESS.garage.lat, lng: BUSINESS.garage.lng }),
    [],
  );

  useEffect(() => {
    if (!allStopsSet || routePoints.length < 2) {
      setPlan(null);
      setRouteStatus("idle");
      return;
    }

    const controller = new AbortController();
    setRouteStatus("loading");

    const mainPairs = routePoints
      .slice(0, -1)
      .map((point, index) => [point, routePoints[index + 1]] as const);

    Promise.all([
      ...mainPairs.map(([from, to]) => fetchRoute(from, to, controller.signal)),
      fetchRoute(garagePoint, routePoints[0], controller.signal),
      fetchRoute(
        routePoints[routePoints.length - 1],
        garagePoint,
        controller.signal,
      ),
    ]).then((results) => {
      if (controller.signal.aborted) return;
      const main = results.slice(
        0,
        mainPairs.length,
      ) as Array<RouteResult | null>;
      const garageToFirst = results[mainPairs.length] as RouteResult | null;
      const lastToGarage = results[mainPairs.length + 1] as RouteResult | null;
      const mainOk = main.length > 0 && main.every(Boolean);
      setPlan({
        main: main.filter((leg): leg is RouteResult => Boolean(leg)),
        garageToFirst,
        lastToGarage,
      });
      setRouteStatus(mainOk ? "ready" : "error");
    });

    return () => controller.abort();
    // routeKey already captures the coordinates this request depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey, allStopsSet]);

  function appendQuickNote(snippet: string) {
    setNote((prev) => {
      if (!prev.trim()) return snippet;
      if (prev.includes(snippet)) return prev;
      return `${prev}, ${snippet}`;
    });
  }

  const steps = [
    {
      label: "Titik muat",
      done:
        loadStops.length > 0 && loadStops.every((stop) => stop.lat !== null),
    },
    {
      label: "Titik bongkar",
      done:
        unloadStops.length > 0 &&
        unloadStops.every((stop) => stop.lat !== null),
    },
    { label: "Nama", done: !customerCheck.nameMissing },
    { label: "Nomor HP", done: !customerCheck.phoneInvalid },
    { label: "Layanan", done: true },
  ];
  const missing = steps.filter((step) => !step.done).map((step) => step.label);

  const wizardSteps = [
    "Rute",
    "Pemesan",
    "Layanan",
    "Bantuan & lantai",
    "Catatan",
    "Estimasi",
  ];

  const straightDistances = useMemo(() => {
    if (!allStopsSet || routePoints.length < 2) return null;
    let mainKm = 0;
    for (let index = 0; index < routePoints.length - 1; index++) {
      mainKm += straightLineKm(routePoints[index], routePoints[index + 1]);
    }
    return {
      garageToLoad: straightLineKm(garagePoint, routePoints[0]),
      loadToUnload: mainKm,
      unloadToGarage: straightLineKm(
        routePoints[routePoints.length - 1],
        garagePoint,
      ),
    };
  }, [allStopsSet, routePoints, garagePoint]);

  const routeDistances = useMemo(() => {
    if (!straightDistances) return null;
    const mainIsComplete =
      routeStatus === "ready" &&
      plan !== null &&
      plan.main.length === routePoints.length - 1;

    if (plan && mainIsComplete) {
      const mainKm = plan.main.reduce(
        (total, leg) => total + leg.distanceKm,
        0,
      );
      return {
        garageToLoad:
          plan.garageToFirst?.distanceKm ?? straightDistances.garageToLoad,
        loadToUnload: mainKm,
        unloadToGarage:
          plan.lastToGarage?.distanceKm ?? straightDistances.unloadToGarage,
      };
    }
    return straightDistances;
  }, [plan, routeStatus, straightDistances, routePoints.length]);

  const quote = useMemo(() => {
    if (!allStopsSet || !routeDistances) return null;

    const loadFloorList = loadStops.map((stop) => floors[stop.id] ?? 1);
    const unloadFloorList = unloadStops.map((stop) => floors[stop.id] ?? 1);

    try {
      return calculateQuote({
        service,
        distances: routeDistances,
        helper,
        waitingTime,
        loadFloor: loadFloorList[0] ?? 1,
        unloadFloor: unloadFloorList[0] ?? 1,
        loadFloors: loadFloorList,
        unloadFloors: unloadFloorList,
        priority,
      });
    } catch {
      return null;
    }
  }, [
    allStopsSet,
    routeDistances,
    service,
    helper,
    waitingTime,
    floors,
    loadStops,
    unloadStops,
    priority,
  ]);

  const waUrl = useMemo(() => {
    if (!quote || !allStopsSet) return null;

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!customerCheck.valid) return null;

    const toWaStop = (stop: Stop, index: number): WaStop => ({
      label: `${stop.kind === "load" ? "M" : "B"}${index + 1}`,
      address:
        stop.address ||
        `Titik di peta (${(stop.lat as number).toFixed(4)}, ${(stop.lng as number).toFixed(4)})`,
      lat: stop.lat as number,
      lng: stop.lng as number,
      floor: floors[stop.id] ?? 1,
    });

    return buildWhatsAppUrl({
      name: trimmedName,
      phone: trimmedPhone,
      pickupDate,
      pickupTime,
      serviceLabel: service === "dalam-kota" ? "Dalam Kota" : "Luar Kota",
      loads: loadStops.map(toWaStop),
      unloads: unloadStops.map(toWaStop),
      helperLabel:
        helper === "none"
          ? "Tanpa bantuan"
          : helper === "driver"
            ? "Sopir ikut bongkar muat"
            : "Sopir + Kenek",
      waitingLabel:
        waitingTime === "over30"
          ? "Lebih dari 30 menit"
          : waitingTime === "min60"
            ? "60 menit"
            : waitingTime === "min90"
              ? "90 menit"
              : "Tanpa waktu tunggu",
      distanceKm: quote.billableKm,
      note: priority
        ? `[PRIORITAS] Sopir tiba ASAP (+Rp 50.000). ${note}`.trim()
        : note,
      quote,
    });
  }, [
    quote,
    allStopsSet,
    loadStops,
    unloadStops,
    name,
    phone,
    customerCheck,
    pickupDate,
    pickupTime,
    service,
    helper,
    waitingTime,
    floors,
    note,
    priority,
  ]);

  useEffect(() => {
    if (step < 2 || analyticsStarted.current) return;
    analyticsStarted.current = true;
    track("wizard_started");
  }, [step]);

  useEffect(() => {
    if (!quote || analyticsEstimate.current) return;
    analyticsEstimate.current = true;
    track("estimate_ready", {
      service,
      billableKm: quote.billableKm,
    });
  }, [quote, service]);

  useEffect(() => {
    if (step !== 6 || !waUrl || analyticsCompleted.current) return;
    analyticsCompleted.current = true;
    track("wizard_completed", { service });
  }, [step, waUrl, service]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest<HTMLAnchorElement>(
        'a[href^="https://wa.me/"]',
      );
      if (!link) return;
      const placement = link.closest(".mobile-bar")
        ? "mobile_bar"
        : link.closest(".hero")
          ? "hero"
          : link.closest(".topbar")
            ? "topbar"
            : link.closest(".fab-dock")
              ? "quick_actions"
              : "inline";
      track("whatsapp_click", { placement });
    }

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  const mainRouteLine = useMemo<Array<[number, number]>>(() => {
    if (routeStatus !== "ready" || !plan) return [];
    return plan.main.flatMap((leg) => leg.coordinates);
  }, [plan, routeStatus]);

  const fallbackLine = useMemo<Array<[number, number]>>(() => {
    if (!allStopsSet || routePoints.length < 2) return [];
    return routePoints.map(
      (point) => [point.lat, point.lng] as [number, number],
    );
  }, [allStopsSet, routePoints]);

  const routeLine = useMemo<Array<[number, number]>>(() => {
    if (routeStatus === "ready") return mainRouteLine;
    if (routeStatus === "error") return fallbackLine;
    return [];
  }, [routeStatus, mainRouteLine, fallbackLine]);

  const garageToFirstLine = useMemo<Array<[number, number]>>(() => {
    if (plan?.garageToFirst) return plan.garageToFirst.coordinates;
    if (routePoints.length === 0) return [];
    return [
      [garagePoint.lat, garagePoint.lng],
      [routePoints[0].lat, routePoints[0].lng],
    ];
  }, [plan, routePoints, garagePoint]);

  const lastToGarageLine = useMemo<Array<[number, number]>>(() => {
    if (plan?.lastToGarage) return plan.lastToGarage.coordinates;
    if (routePoints.length === 0) return [];
    const last = routePoints[routePoints.length - 1];
    return [
      [last.lat, last.lng],
      [garagePoint.lat, garagePoint.lng],
    ];
  }, [plan, routePoints, garagePoint]);

  const fitPositions = useMemo<Array<[number, number]>>(
    () => [
      ...routeLine,
      ...garageToFirstLine,
      ...lastToGarageLine,
      ...routePoints.map((point) => [point.lat, point.lng] as [number, number]),
      ...(draft ? [[draft.lat, draft.lng] as [number, number]] : []),
    ],
    [routeLine, garageToFirstLine, lastToGarageLine, routePoints, draft],
  );

  const routeSummary = useMemo(() => {
    if (routeStatus !== "ready" || !plan) return null;
    return {
      km:
        plan.main.reduce((total, leg) => total + leg.distanceKm, 0) +
        (plan.garageToFirst?.distanceKm ?? 0) +
        (plan.lastToGarage?.distanceKm ?? 0),
      minutes:
        plan.main.reduce((total, leg) => total + leg.durationMin, 0) +
        (plan.garageToFirst?.durationMin ?? 0) +
        (plan.lastToGarage?.durationMin ?? 0),
    };
  }, [plan, routeStatus]);

  const routeSummaryLabel = !allStopsSet
    ? "Rute belum lengkap"
    : routeStatus === "ready" && routeSummary
      ? `${stops.length} titik · ${routeSummary.km.toFixed(1)} km`
      : `${stops.length} titik · rute disiapkan`;

  function updateStopPoint(
    id: string,
    lat: number,
    lng: number,
    address: string,
  ) {
    setStops((prev) =>
      prev.map((stop) =>
        stop.id === id ? { ...stop, lat, lng, address } : stop,
      ),
    );
  }

  function addStop(kind: StopKind) {
    const stop: Stop = {
      id: `stop-${nextStopId.current++}`,
      kind,
      lat: null,
      lng: null,
      address: "",
    };
    setStops((prev) => {
      if (kind === "unload") return [...prev, stop];
      const lastLoad = prev.map((item) => item.kind).lastIndexOf("load");
      return [
        ...prev.slice(0, lastLoad + 1),
        stop,
        ...prev.slice(lastLoad + 1),
      ];
    });
    setActiveId(stop.id);
    setDraft(null);
    setFitTick((tick) => tick + 1);
    setMapOpen(true);
  }

  function removeStop(id: string) {
    const target = stops.find((stop) => stop.id === id);
    if (!target) return;

    const sameKind = stops.filter((stop) => stop.kind === target.kind);
    if (sameKind.length <= 1) {
      setStops((prev) =>
        prev.map((stop) =>
          stop.id === id
            ? { ...stop, lat: null, lng: null, address: "" }
            : stop,
        ),
      );
      setActiveId(id);
      return;
    }

    const fallback = sameKind.find((stop) => stop.id !== id);
    setStops((prev) => prev.filter((stop) => stop.id !== id));
    if (activeId === id && fallback) setActiveId(fallback.id);
  }

  function changeFloor(id: string, next: number) {
    setFloors((prev) => ({
      ...prev,
      [id]: Math.min(20, Math.max(1, next)),
    }));
  }

  function pick(lat: number, lng: number) {
    const address = `Titik di peta (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
    setDraft({ lat, lng, address });
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocateStatus({
        tone: "error",
        text: "Peramban ini belum mendukung deteksi lokasi. Silakan cari alamat atau ketuk peta.",
      });
      return;
    }
    setLocateStatus({
      tone: "info",
      text: "Mencari lokasi Anda. Izinkan akses lokasi jika diminta.",
    });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const address = `Lokasi saat ini (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`;
        setDraft({ lat: latitude, lng: longitude, address });
        setLocateStatus({
          tone: "info",
          text: "Lokasi ditemukan. Tekan Simpan titik untuk memakai titik ini.",
        });
      },
      (error) => {
        setLocateStatus({
          tone: "error",
          text:
            error.code === error.PERMISSION_DENIED
              ? "Izin lokasi ditolak. Anda masih bisa mencari alamat atau mengetuk peta."
              : "Lokasi tidak dapat ditemukan. Coba lagi, cari alamat, atau ketuk peta.",
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }

  function selectPoint(lat: number, lng: number, address: string) {
    setDraft({ lat, lng, address });
  }

  function saveDraft() {
    if (!draft || !activeStop) return;
    updateStopPoint(activeStop.id, draft.lat, draft.lng, draft.address);
    setMapOpen(false);
  }

  const helperOptions: Array<{
    key: Helper;
    title: string;
    description: string;
    price: number;
    icon: typeof IconBox;
  }> = [
    {
      key: "none",
      title: "Bongkar muat sendiri",
      description: "Barang diserahkan di depan armada.",
      price: BUSINESS.pricing.helper.none,
      icon: IconBox,
    },
    {
      key: "driver",
      title: "Sopir ikut bongkar muat",
      description: "Satu tenaga tambahan dari kami.",
      price: BUSINESS.pricing.helper.driver,
      icon: IconTruck,
    },
    {
      key: "driverAndAssistant",
      title: "Sopir + Kenek",
      description: "Dua tenaga untuk barang lebih banyak.",
      price: BUSINESS.pricing.helper.driverAndAssistant,
      icon: IconUsers,
    },
  ];

  const serviceLabel = service === "dalam-kota" ? "Dalam Kota" : "Luar Kota";
  const scheduleLabel = formatSchedule(pickupDate, pickupTime);
  const helperLabel =
    helperOptions.find((option) => option.key === helper)?.title ??
    "Tanpa bantuan";

  const waitingOptions: Array<{
    key: WaitingTime;
    title: string;
    price: number;
  }> = [
    {
      key: "none",
      title: "Tanpa waktu tunggu",
      price: BUSINESS.pricing.waitingTime.none,
    },
    {
      key: "over30",
      title: "Lebih dari 30 menit",
      price: BUSINESS.pricing.waitingTime.over30,
    },
    {
      key: "min60",
      title: "60 menit",
      price: BUSINESS.pricing.waitingTime.min60,
    },
    {
      key: "min90",
      title: "90 menit",
      price: BUSINESS.pricing.waitingTime.min90,
    },
  ];
  const waitingOption = waitingOptions.find(
    (option) => option.key === waitingTime,
  );
  const waitingLabel = waitingOption?.title ?? "Tanpa waktu tunggu";

  function scrollToPanel() {
    const body =
      panelRef.current?.querySelector<HTMLElement>(".booking-tabpanel");
    body?.scrollTo({ top: 0, behavior: "auto" });
  }

  function closeBooking() {
    setBookingOpen(false);
    if (window.location.hash === "#pesan") {
      history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
    }
  }

  function scrollToTop() {
    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function validateRoute() {
    if (allStopsSet) {
      setRouteError(false);
      return true;
    }

    setRouteError(true);
    window.setTimeout(() => {
      document.getElementById("route-open-map")?.focus();
    }, 0);

    return false;
  }

  function validateCustomerStep() {
    setCustomerAttempted(true);
    if (customerCheck.valid) {
      return true;
    }

    window.setTimeout(() => {
      document
        .getElementById(
          customerCheck.nameMissing ? "customer-name" : "customer-phone",
        )
        ?.focus();
    }, 0);

    return false;
  }

  function advance() {
    if (step === 1 && !validateRoute()) return;
    if (step === 2 && !validateCustomerStep()) return;
    const next = Math.min(wizardSteps.length, step + 1);
    setStepDirection("forward");
    setStep(next);
    scrollToPanel();
  }

  function goBack() {
    setStepDirection("back");
    setStep((current) => Math.max(1, current - 1));
    scrollToPanel();
  }

  function goToStep(target: number) {
    if (target === step) return;
    if (target > 1 && !validateRoute()) {
      if (step !== 1) {
        setStepDirection("back");
        setStep(1);
        scrollToPanel();
      }
      return;
    }
    if (target > 2 && !validateCustomerStep()) {
      if (step !== 2) {
        setStepDirection("back");
        setStep(2);
        scrollToPanel();
      }
      return;
    }
    setStepDirection(target > step ? "forward" : "back");
    setStep(target);
    scrollToPanel();
  }

  function openMap(stopId?: string, readOnly = false) {
    const target = stopId
      ? stops.find((stop) => stop.id === stopId)
      : (activeStop ?? stops[0]);
    if (!target) return;
    mapTriggerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setActiveId(target.id);
    setDraft(
      target.lat !== null && target.lng !== null
        ? { lat: target.lat, lng: target.lng, address: target.address }
        : null,
    );
    setLocateStatus(null);
    setFitTick((tick) => tick + 1);
    setMapReadOnly(readOnly);
    setMapOpen(true);
    track("map_opened", { kind: target.kind });
  }

  function showRoute(mode: StopKind) {
    const missing = stops.find(
      (stop) => stop.kind === mode && stop.lat === null,
    );
    const target = missing ?? stops.find((stop) => stop.kind === mode);
    openMap(target?.id, !missing);
  }

  function openRouteMap() {
    const target =
      orderedStops.find((stop) => stop.lat === null) ?? orderedStops[0];
    openMap(target?.id);
  }

  function handleRouteShortcut() {
    if (allStopsSet) {
      openMap(undefined, true);
      return;
    }
    if (step !== 1) {
      goToStep(1);
      return;
    }
    openRouteMap();
  }

  const showMobileBar = !mapOpen && !galleryOpen;

  return (
    <div className={showMobileBar ? "site-shell has-mobile-bar" : "site-shell"}>
      <a className="skip-link" href="#pesan">
        Langsung ke form pesanan
      </a>

      {/* Google Stitch Topbar */}
      <div className="site-topbar">
        <div className="container topbar-inner">
          <div className="topbar-left">
            <span className="topbar-item">
              <IconTruck size={15} />
              <strong>Area Layanan:</strong>
              <span>
                Kebonbatur, Mranggen, Demak, Kota Semarang, Kab. Semarang
              </span>
            </span>
            <span className="topbar-item topbar-hours">
              <IconClock size={15} />
              <span>Buka Setiap Hari 06.00 – 22.00 WIB</span>
            </span>
          </div>
          <div className="topbar-right">
            <div className="topbar-badge">
              <span className="pulsing-dot" aria-hidden="true" />
              <span>Respon Cepat &lt; 5 Menit</span>
            </div>
            <a className="topbar-phone" href={`tel:+${BUSINESS.whatsapp}`}>
              <IconPhone size={14} />
              <span>{BUSINESS.phoneDisplay}</span>
            </a>
          </div>
        </div>
      </div>

      <header className="site-header">
        <div className="container header-inner">
          <a
            className="brand"
            href="#beranda"
            aria-label="Jasa Angkut Slamet — beranda"
          >
            <span className="brand-mark">
              <IconTruck size={23} />
            </span>
            <span>
              <span className="brand-name">Jasa Angkut Slamet</span>
              <span className="brand-meta brand-meta-desktop">
                Armada Pindahan &amp; Logistik Terpercaya
              </span>
            </span>
          </a>

          <nav className="header-nav" aria-label="Navigasi utama">
            {NAV_LINKS.map((link) => (
              <a
                key={link.id}
                className={`nav-link${getNavActiveKey(activeNav) === link.id ? " is-active" : ""}`}
                href={`#${link.id}`}
                onClick={() => setActiveNav(link.id)}
                aria-current={
                  getNavActiveKey(activeNav) === link.id ? "true" : undefined
                }
              >
                {link.shortLabel}
              </a>
            ))}
          </nav>

          <div className="header-actions">
            <a className="header-phone" href={`tel:+${BUSINESS.whatsapp}`}>
              <IconPhone size={16} />
              <span>{BUSINESS.phoneDisplay}</span>
            </a>
            <a
              className="btn btn-primary btn-sm"
              href={waChatUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Pesan via WhatsApp"
            >
              <IconWhatsApp size={16} />
              <span className="btn-label-desktop">Pesan via WhatsApp</span>
              <span className="btn-label-mobile">WhatsApp</span>
            </a>
            <button
              type="button"
              className="nav-burger"
              ref={menuButtonRef}
              aria-label={menuOpen ? "Tutup menu" : "Buka menu"}
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? "mobile-menu" : undefined}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? (
                <IconX size={20} />
              ) : (
                <svg
                  viewBox="0 0 20 20"
                  width="20"
                  height="20"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2.5 5h15M2.5 10h15M2.5 15h15"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav
            id="mobile-menu"
            className="mobile-menu"
            aria-label="Navigasi mobile"
            ref={menuRef}
          >
            {NAV_LINKS.map((link) => (
              <a
                key={link.id}
                className={`mobile-menu-link${getNavActiveKey(activeNav) === link.id ? " is-active" : ""}`}
                href={`#${link.id}`}
                onClick={() => {
                  setActiveNav(link.id);
                  setMenuOpen(false);
                }}
                aria-current={
                  getNavActiveKey(activeNav) === link.id ? "true" : undefined
                }
              >
                <NavIcon id={link.id} />
                {link.label}
              </a>
            ))}
            <a
              className="mobile-menu-link is-wa"
              href={waChatUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMenuOpen(false)}
            >
              <IconWhatsApp size={18} />
              Chat WhatsApp
            </a>
          </nav>
        )}
      </header>

      <main>
        {/* Google Stitch Hero Section */}
        <section
          className="hero-section"
          id="beranda"
          aria-labelledby="hero-title"
        >
          <div className="hero-ambient-glow hero-glow-1" aria-hidden="true" />
          <div className="hero-ambient-glow hero-glow-2" aria-hidden="true" />

          <div className="container hero-container">
            <div className="hero-top-row">
              {bookingOpen && (
                <>
                  <div
                    className="map-backdrop"
                    onClick={closeBooking}
                    aria-hidden="true"
                  />
                  <section
                    className="workspace booking-modal booking-modal-full"
                    id="pesan"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="form-title"
                  >
                    {mapOpen && (
                      <>
                        <div
                          className="map-backdrop"
                          onClick={() => setMapOpen(false)}
                          aria-hidden="true"
                        />
                        <div
                          className="map-card is-modal"
                          id="peta"
                          ref={mapModalRef}
                          role="dialog"
                          aria-modal="true"
                          aria-labelledby="map-modal-title"
                        >
                          <div className="map-card-head">
                            <div className="map-card-title">
                              <h2 id="map-modal-title">
                                {mapReadOnly
                                  ? "Lihat Rute Perjalanan"
                                  : `Pilih titik ${activeStop ? stopLabel(activeStop, stops) : ""}`}
                              </h2>
                              <p>
                                {mapReadOnly
                                  ? "Posisi titik muat dan bongkar terkunci agar tidak berubah. Tutup untuk kembali ke formulir."
                                  : `Klik peta, cari alamat, atau pakai lokasi saya. Tekan `}
                                {!mapReadOnly && (
                                  <>
                                    <strong>Simpan titik</strong> untuk
                                    menyimpan{" "}
                                    {activeStop
                                      ? stopLabel(activeStop, stops)
                                      : "titik"}
                                    .
                                  </>
                                )}
                              </p>
                            </div>
                            <div className="map-card-head-actions">
                              <button
                                type="button"
                                className="map-close"
                                onClick={() => setMapOpen(false)}
                                aria-label="Tutup peta"
                                autoFocus
                              >
                                <IconX size={18} />
                              </button>
                            </div>
                          </div>

                          <div className="map-canvas">
                            <Suspense
                              fallback={
                                <div className="map-loading" role="status">
                                  <span
                                    className="spinner"
                                    aria-hidden="true"
                                  />
                                  <span>Memuat peta…</span>
                                </div>
                              }
                            >
                              <MapErrorBoundary
                                key={mapBoundaryKey}
                                onRetry={() =>
                                  setMapBoundaryKey((key) => key + 1)
                                }
                              >
                                <MapCanvas
                                  stops={stops}
                                  activeId={activeId}
                                  draft={mapReadOnly ? null : draft}
                                  routeLine={routeLine}
                                  garageToFirstLine={garageToFirstLine}
                                  lastToGarageLine={lastToGarageLine}
                                  fitPositions={fitPositions}
                                  fitSignal={fitTick}
                                  onPick={mapReadOnly ? undefined : pick}
                                  onDraftMove={mapReadOnly ? undefined : pick}
                                  readOnly={mapReadOnly}
                                />
                              </MapErrorBoundary>
                            </Suspense>
                            {!mapReadOnly && (
                              <>
                                <MapSearchControl
                                  active={activeStop?.kind ?? "load"}
                                  activeLabel={
                                    activeStop
                                      ? stopLabel(activeStop, stops)
                                      : "M1"
                                  }
                                  onSelect={selectPoint}
                                />
                                <button
                                  type="button"
                                  className="map-locate"
                                  onClick={useMyLocation}
                                >
                                  <IconTarget size={17} />
                                  <span>Lokasi saya</span>
                                </button>
                              </>
                            )}
                          </div>

                          <div className="map-modal-foot">
                            {locateStatus && !mapReadOnly && (
                              <p
                                className={`map-status is-${locateStatus.tone}`}
                                role="status"
                                aria-live="polite"
                              >
                                {locateStatus.text}
                              </p>
                            )}
                            {mapReadOnly ? (
                              <div className="map-draft" aria-live="polite">
                                <IconRoute
                                  size={20}
                                  style={{
                                    color: "var(--forest)",
                                    flex: "none",
                                  }}
                                />
                                <div className="map-draft-text">
                                  <span className="map-draft-label">
                                    Rute Tersimpan (Terkunci)
                                  </span>
                                  <p>
                                    {routeSummaryLabel} · Semua titik muat dan
                                    bongkar tetap pada posisinya.
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div
                                className={`map-draft${draft ? "" : " is-empty"}`}
                                aria-live="polite"
                              >
                                <span
                                  className={`segment-dot ${activeStop?.kind ?? "load"}`}
                                  aria-hidden="true"
                                />
                                <div className="map-draft-text">
                                  <span className="map-draft-label">
                                    {activeStop
                                      ? `${stopLabel(activeStop, stops)} · Titik ${STOP_KIND_LABEL[activeStop.kind]}`
                                      : "Titik"}
                                  </span>
                                  <p>
                                    {draft
                                      ? draft.address
                                      : "Belum ada titik. Klik peta, cari alamat, atau pakai lokasi saya."}
                                  </p>
                                </div>
                              </div>
                            )}
                            <div className="map-modal-actions">
                              {mapReadOnly ? (
                                <>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setMapReadOnly(false)}
                                  >
                                    Ubah Titik
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    onClick={() => setMapOpen(false)}
                                  >
                                    Tutup Peta
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setMapOpen(false)}
                                  >
                                    Batal
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    onClick={saveDraft}
                                    disabled={!draft}
                                  >
                                    <IconMapPin size={15} />
                                    Simpan titik
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    <section
                      className="panel"
                      aria-labelledby="form-title"
                      ref={panelRef}
                    >
                      <div className="panel-head">
                        <div>
                          <span className="panel-eyebrow">Pesan angkutan</span>
                          <h2 className="panel-title" id="form-title">
                            Rute &amp; detail angkutan
                          </h2>
                          <p className="panel-sub">
                            Pilih bagian yang ingin diisi, lalu tekan Lanjut.
                            Estimasi muncul di bagian terakhir.
                          </p>
                        </div>
                        <div className="panel-head-side">
                          <div className="progress">
                            <div className="progress-label">
                              <span>
                                Bagian {step} dari {wizardSteps.length}
                              </span>
                              <span>
                                {Math.round((step / wizardSteps.length) * 100)}%
                              </span>
                            </div>
                            <div
                              className="progress-track"
                              role="progressbar"
                              aria-valuemin={0}
                              aria-valuemax={wizardSteps.length}
                              aria-valuenow={step}
                              aria-label="Langkah pengisian pesanan"
                            >
                              <span
                                className="progress-fill"
                                style={{
                                  width: `${(step / wizardSteps.length) * 100}%`,
                                }}
                              />
                            </div>
                          </div>

                          <div className="panel-route">
                            <span
                              className={`panel-route-summary${allStopsSet ? "" : " is-empty"}`}
                            >
                              {allStopsSet ? (
                                <IconRoute size={14} />
                              ) : (
                                <IconAlert size={14} />
                              )}
                              {routeSummaryLabel}
                            </span>
                            <button
                              type="button"
                              className="panel-route-btn"
                              onClick={handleRouteShortcut}
                            >
                              <IconMapPin size={14} />
                              {allStopsSet ? "Lihat rute" : "Lengkapi rute"}
                            </button>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="map-close booking-close"
                          onClick={closeBooking}
                          aria-label="Tutup kalkulator tarif"
                        >
                          <IconX size={18} />
                        </button>
                      </div>

                      <div className="panel-body">
                        <div
                          className="booking-tabs"
                          role="tablist"
                          aria-label="Bagian kalkulator tarif"
                        >
                          {wizardSteps.map((label, index) => {
                            const value = index + 1;
                            const isActive = value === step;
                            const isDone = value < step;
                            return (
                              <button
                                key={label}
                                type="button"
                                role="tab"
                                id={`booking-tab-${value}`}
                                aria-selected={isActive}
                                aria-controls={`booking-tabpanel-${value}`}
                                tabIndex={isActive ? 0 : -1}
                                className={`booking-tab${isActive ? " is-active" : ""}${isDone ? " is-done" : ""}`}
                                onClick={() => goToStep(value)}
                              >
                                <span className="booking-tab-marker">
                                  {isDone ? <IconCheck size={12} /> : value}
                                </span>
                                <span className="booking-tab-label">
                                  {label}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        <div
                          className={`wizard-body booking-tabpanel${stepDirection === "back" ? " is-back" : ""}`}
                          key={step}
                          role="tabpanel"
                          id={`booking-tabpanel-${step}`}
                          aria-labelledby={`booking-tab-${step}`}
                          tabIndex={0}
                        >
                          {step === 1 && (
                            <section className="form-section route-step">
                              <div className="section-head">
                                <span className="step-badge">1</span>
                                <div className="section-copy">
                                  <h3 id="wizard-step-title" tabIndex={-1}>
                                    Rute angkutan
                                  </h3>
                                  <p>
                                    Tandai titik muat dan bongkar dulu. Jarak
                                    dan rute mobil dihitung otomatis.
                                  </p>
                                </div>
                              </div>

                              <div className="route-preview">
                                <div
                                  className={`route-timeline${routeStatus === "ready" ? " is-ready" : ""}`}
                                >
                                  {(
                                    [
                                      { kind: "load", items: loadStops },
                                      { kind: "unload", items: unloadStops },
                                    ] as Array<{
                                      kind: StopKind;
                                      items: Stop[];
                                    }>
                                  ).map(({ kind, items }) => (
                                    <div
                                      className={`map-preview-group is-${kind}`}
                                      key={kind}
                                    >
                                      <div className="map-preview-group-head">
                                        <span className="map-preview-group-title">
                                          <span
                                            className={`segment-dot ${kind}`}
                                            aria-hidden="true"
                                          />
                                          Titik {STOP_KIND_LABEL[kind]}
                                        </span>
                                        <button
                                          type="button"
                                          className="map-preview-add"
                                          onClick={() => addStop(kind)}
                                        >
                                          <IconPlus size={13} />
                                          Tambah
                                        </button>
                                      </div>
                                      <ul className="map-preview-rows">
                                        {items.map((stop, index) => {
                                          const hasPoint =
                                            stop.lat !== null &&
                                            stop.lng !== null;
                                          const label = `${kind === "load" ? "M" : "B"}${index + 1}`;
                                          const coords = hasPoint
                                            ? `${(stop.lat as number).toFixed(5)}, ${(stop.lng as number).toFixed(5)}`
                                            : "Belum ditandai";
                                          return (
                                            <li
                                              key={stop.id}
                                              className={`map-preview-row${hasPoint ? "" : " is-empty"}`}
                                            >
                                              <div className="map-preview-main">
                                                <button
                                                  type="button"
                                                  className="map-preview-pick"
                                                  onClick={() =>
                                                    openMap(stop.id)
                                                  }
                                                  aria-label={`${hasPoint ? "Ubah" : "Pilih"} titik ${label}: ${coords}`}
                                                >
                                                  <span
                                                    className={`map-preview-label is-${kind}`}
                                                  >
                                                    {label}
                                                  </span>
                                                  <span className="map-preview-coords">
                                                    {coords}
                                                  </span>
                                                  <span className="map-preview-action">
                                                    {hasPoint
                                                      ? "Ubah"
                                                      : "Pilih"}
                                                  </span>
                                                </button>
                                                {hasPoint && (
                                                  <span
                                                    className="map-preview-address"
                                                    title={stop.address}
                                                  >
                                                    {stop.address}
                                                  </span>
                                                )}
                                              </div>
                                              {(items.length > 1 ||
                                                hasPoint) && (
                                                <button
                                                  type="button"
                                                  className="map-preview-remove"
                                                  aria-label={`Hapus titik ${label}`}
                                                  onClick={() =>
                                                    removeStop(stop.id)
                                                  }
                                                >
                                                  Hapus
                                                </button>
                                              )}
                                            </li>
                                          );
                                        })}
                                      </ul>
                                    </div>
                                  ))}
                                </div>

                                <div className="route-preview-head">
                                  <div>
                                    <span className="route-preview-label">
                                      Titik angkutan
                                    </span>
                                    <p className="route-preview-note">
                                      Minimal satu titik muat dan satu titik
                                      bongkar.
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    id="route-open-map"
                                    className="btn btn-primary btn-sm"
                                    onClick={() =>
                                      allStopsSet
                                        ? openMap(undefined, true)
                                        : openRouteMap()
                                    }
                                  >
                                    <IconMapPin size={15} />
                                    {allStopsSet
                                      ? "Lihat rute di peta"
                                      : "Buka peta"}
                                  </button>
                                </div>

                                <div className="route-sequence">
                                  <div className="route-sequence-head">
                                    <span className="route-sequence-kicker">
                                      Urutan rute
                                    </span>
                                    <span
                                      className={`route-sequence-meta${routeStatus === "error" ? " is-warn" : ""}`}
                                      aria-live="polite"
                                    >
                                      {routeStatus === "loading" && (
                                        <>
                                          <span
                                            className="spinner"
                                            aria-hidden="true"
                                          />
                                          <span>Menghitung rute...</span>
                                        </>
                                      )}
                                      {routeStatus === "ready" &&
                                        routeSummary && (
                                          <>
                                            <IconRoute size={14} />
                                            <span>
                                              {routeSummary.km.toFixed(1)} km ·
                                              ±
                                              {Math.max(
                                                1,
                                                Math.round(
                                                  routeSummary.minutes,
                                                ),
                                              )}{" "}
                                              mnt
                                            </span>
                                          </>
                                        )}
                                      {routeStatus === "error" && (
                                        <>
                                          <IconAlert size={14} />
                                          <span>
                                            Rute mobil belum tersedia.
                                          </span>
                                        </>
                                      )}
                                      {routeStatus === "idle" &&
                                        !allStopsSet && (
                                          <>
                                            <IconAlert size={14} />
                                            <span>
                                              Lengkapi titik untuk menghitung
                                              rute.
                                            </span>
                                          </>
                                        )}
                                    </span>
                                  </div>
                                  <ol
                                    className="route-sequence-list"
                                    aria-label="Urutan titik angkutan"
                                  >
                                    {orderedStops.map((stop, index) => {
                                      const label = stopLabel(stop, stops);
                                      const hasPoint =
                                        stop.lat !== null && stop.lng !== null;
                                      return (
                                        <li
                                          className="route-sequence-item"
                                          key={stop.id}
                                        >
                                          {index > 0 && (
                                            <IconArrowRight
                                              size={13}
                                              className="route-sequence-arrow"
                                            />
                                          )}
                                          <span
                                            className={`route-sequence-stop is-${stop.kind}${hasPoint ? "" : " is-empty"}`}
                                          >
                                            <span className="route-sequence-badge">
                                              {label}
                                            </span>
                                            <span className="route-sequence-state">
                                              Titik {STOP_KIND_LABEL[stop.kind]}
                                              {hasPoint
                                                ? ""
                                                : ", belum ditandai"}
                                            </span>
                                          </span>
                                        </li>
                                      );
                                    })}
                                  </ol>
                                </div>

                                {routeError && !allStopsSet && (
                                  <p className="field-error" role="alert">
                                    <IconAlert size={15} />
                                    Tandai titik muat dan bongkar dulu sebelum
                                    lanjut.
                                  </p>
                                )}
                              </div>
                            </section>
                          )}

                          {step === 2 && (
                            <section className="form-section">
                              <div className="section-head">
                                <span className="step-badge">2</span>
                                <div className="section-copy">
                                  <h3 id="wizard-step-title" tabIndex={-1}>
                                    Data pemesan
                                  </h3>
                                  <p>
                                    Nama dan nomor HP wajib diisi agar pesanan
                                    bisa dikirim lewat WhatsApp.
                                  </p>
                                </div>
                              </div>

                              <div className="field-stack">
                                <div className="field">
                                  <label
                                    className="field-label"
                                    htmlFor="customer-name"
                                  >
                                    Nama lengkap
                                  </label>
                                  <div
                                    className={`input-shell${nameError ? " is-invalid" : ""}`}
                                  >
                                    <span className="input-icon">
                                      <IconUser size={18} />
                                    </span>
                                    <input
                                      id="customer-name"
                                      className="field-input"
                                      value={name}
                                      onChange={(event) =>
                                        setName(event.target.value)
                                      }
                                      placeholder="Contoh: Budi Santoso"
                                      autoComplete="name"
                                      enterKeyHint="next"
                                      required
                                      maxLength={80}
                                      aria-invalid={nameError}
                                      aria-describedby={
                                        nameError ? "name-error" : undefined
                                      }
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                          event.preventDefault();
                                          document
                                            .getElementById("customer-phone")
                                            ?.focus();
                                        }
                                      }}
                                    />
                                  </div>
                                  {nameError && (
                                    <p
                                      className="field-error"
                                      id="name-error"
                                      role="alert"
                                    >
                                      <IconAlert size={15} />
                                      Nama belum diisi.
                                    </p>
                                  )}
                                </div>

                                <div className="field">
                                  <label
                                    className="field-label"
                                    htmlFor="customer-phone"
                                  >
                                    Nomor HP / WhatsApp
                                  </label>
                                  <div
                                    className={`input-shell${phoneError ? " is-invalid" : ""}`}
                                  >
                                    <span className="input-icon">
                                      <IconPhone size={18} />
                                    </span>
                                    <input
                                      id="customer-phone"
                                      className="field-input"
                                      type="tel"
                                      value={phone}
                                      onChange={(event) =>
                                        setPhone(event.target.value)
                                      }
                                      placeholder="0813 2762 3942"
                                      inputMode="tel"
                                      autoComplete="tel"
                                      enterKeyHint="next"
                                      required
                                      maxLength={20}
                                      aria-invalid={phoneError}
                                      aria-describedby={
                                        phoneError
                                          ? "phone-error"
                                          : "phone-hint"
                                      }
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                          event.preventDefault();
                                          advance();
                                        }
                                      }}
                                    />
                                  </div>
                                  {phoneError ? (
                                    <p
                                      className="field-error"
                                      id="phone-error"
                                      role="alert"
                                    >
                                      <IconAlert size={15} />
                                      {phone.trim().length > 0
                                        ? "Nomor HP belum benar. Contoh: 0813 2762 3942"
                                        : "Nomor HP wajib diisi. Contoh: 0813 2762 3942"}
                                    </p>
                                  ) : (
                                    <p className="field-hint" id="phone-hint">
                                      Kami hanya menghubungi nomor ini untuk
                                      pesanan Anda.
                                    </p>
                                  )}
                                </div>

                                <div className="field schedule-field">
                                  <div className="field-label-row">
                                    <span className="field-label">
                                      Jadwal angkut
                                    </span>
                                    <span className="badge-optional">
                                      Opsional
                                    </span>
                                  </div>
                                  <div className="field-grid">
                                    <div className="field">
                                      <label
                                        className="field-sublabel"
                                        htmlFor="pickup-date"
                                      >
                                        Tanggal
                                      </label>
                                      <div className="input-shell">
                                        <span className="input-icon">
                                          <IconCalendar size={18} />
                                        </span>
                                        <input
                                          id="pickup-date"
                                          className="field-input"
                                          type="date"
                                          value={pickupDate}
                                          min={today}
                                          onChange={(event) =>
                                            setPickupDate(event.target.value)
                                          }
                                        />
                                      </div>
                                    </div>
                                    <div className="field">
                                      <label
                                        className="field-sublabel"
                                        htmlFor="pickup-time"
                                      >
                                        Jam angkut
                                      </label>
                                      <div className="input-shell">
                                        <span className="input-icon">
                                          <IconClock size={18} />
                                        </span>
                                        <select
                                          id="pickup-time"
                                          className="field-input field-select"
                                          value={pickupTime}
                                          onChange={(event) =>
                                            setPickupTime(event.target.value)
                                          }
                                          aria-label="Pilih jam dan menit angkut"
                                        >
                                          <option value="">
                                            -- Pilih Jam &amp; Menit --
                                          </option>
                                          {TIME_GROUPS.map((grp) => (
                                            <optgroup
                                              key={grp.group}
                                              label={grp.group}
                                            >
                                              {grp.options.map((opt) => (
                                                <option
                                                  key={opt.value}
                                                  value={opt.value}
                                                >
                                                  {opt.label}
                                                </option>
                                              ))}
                                            </optgroup>
                                          ))}
                                          {pickupTime &&
                                            !TIME_GROUPS.some((g) =>
                                              g.options.some(
                                                (o) => o.value === pickupTime,
                                              ),
                                            ) && (
                                              <option value={pickupTime}>
                                                Waktu: {pickupTime} WIB
                                              </option>
                                            )}
                                        </select>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="time-presets-container">
                                    <span className="time-presets-label">
                                      Pilihan cepat:
                                    </span>
                                    {TIME_PRESETS.map((preset) => (
                                      <button
                                        key={preset.time}
                                        type="button"
                                        className={`time-chip${pickupTime === preset.time ? " is-active" : ""}`}
                                        onClick={() =>
                                          setPickupTime(preset.time)
                                        }
                                      >
                                        {preset.label}
                                      </button>
                                    ))}
                                  </div>

                                  {pickupTime && (
                                    <div className="time-selected-alert">
                                      <IconClock size={14} />
                                      <span>
                                        Jam jemput:{" "}
                                        {formatPickupTime(pickupTime)}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setPickupTime("")}
                                        style={{
                                          marginLeft: 8,
                                          background: "none",
                                          border: "none",
                                          color: "var(--danger)",
                                          cursor: "pointer",
                                          fontSize: "0.75rem",
                                          fontWeight: 600,
                                          textDecoration: "underline",
                                          padding: 0,
                                        }}
                                        title="Hapus pilihan jam"
                                      >
                                        Hapus
                                      </button>
                                    </div>
                                  )}

                                  <p className="field-hint">
                                    Kosongkan jika jadwal akan dibicarakan lewat
                                    WhatsApp.
                                  </p>
                                </div>
                              </div>
                            </section>
                          )}

                          {step === 3 && (
                            <section className="form-section">
                              <div className="section-head">
                                <span className="step-badge">3</span>
                                <div className="section-copy">
                                  <h3 id="wizard-step-title" tabIndex={-1}>
                                    Layanan
                                  </h3>
                                  <p>Pilih jangkauan rute angkutan Anda.</p>
                                </div>
                              </div>

                              <div
                                className="choice-grid"
                                role="radiogroup"
                                aria-label="Layanan"
                              >
                                <button
                                  type="button"
                                  role="radio"
                                  aria-checked={service === "dalam-kota"}
                                  className={`choice-card${service === "dalam-kota" ? " is-selected" : ""}`}
                                  onClick={() => setService("dalam-kota")}
                                >
                                  <span className="choice-icon">
                                    <IconBuilding size={18} />
                                  </span>
                                  <span className="choice-copy">
                                    <span className="choice-title">
                                      Dalam Kota
                                    </span>
                                    <span
                                      className="choice-meta"
                                      style={{
                                        fontSize: "0.75rem",
                                        color: "var(--ink-soft)",
                                        display: "block",
                                      }}
                                    >
                                      Demak &amp; Semarang
                                    </span>
                                  </span>
                                  <span className="choice-check">
                                    <IconCheck size={12} />
                                  </span>
                                </button>

                                <button
                                  type="button"
                                  role="radio"
                                  aria-checked={service === "luar-kota"}
                                  className={`choice-card${service === "luar-kota" ? " is-selected" : ""}`}
                                  onClick={() => setService("luar-kota")}
                                >
                                  <span className="choice-icon">
                                    <IconRoute size={18} />
                                  </span>
                                  <span className="choice-copy">
                                    <span className="choice-title">
                                      Luar Kota
                                    </span>
                                    <span
                                      className="choice-meta"
                                      style={{
                                        fontSize: "0.75rem",
                                        color: "var(--ink-soft)",
                                        display: "block",
                                      }}
                                    >
                                      Antar kota (+50% ongkos)
                                    </span>
                                  </span>
                                  <span className="choice-check">
                                    <IconCheck size={12} />
                                  </span>
                                </button>
                              </div>

                              <div
                                className={`priority-toggle-card${priority ? " is-active" : ""}`}
                                style={{ marginTop: 0 }}
                              >
                                <div className="priority-toggle-row">
                                  <div className="priority-toggle-info">
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        flexWrap: "wrap",
                                      }}
                                    >
                                      <span
                                        className="field-label"
                                        style={{ margin: 0, fontWeight: 700 }}
                                      >
                                        Prioritas Pengiriman Langsung
                                      </span>
                                      {priority && (
                                        <span className="priority-badge-chip">
                                          Langsung Jalan
                                        </span>
                                      )}
                                    </div>
                                    <p
                                      className="field-hint"
                                      style={{ marginTop: 4 }}
                                    >
                                      {priority
                                        ? "Aktif: armada berangkat secepatnya. Tambahan +Rp 50.000."
                                        : "Tidak aktif: jadwal reguler, armada tiba maksimal 4 jam."}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    role="switch"
                                    aria-checked={priority}
                                    className={`toggle-switch${priority ? " is-on" : ""}`}
                                    onClick={() => setPriority((v) => !v)}
                                    aria-label="Toggle prioritas pengiriman langsung"
                                  >
                                    <span className="toggle-knob" />
                                  </button>
                                </div>
                                {priority && (
                                  <div
                                    className="priority-badge"
                                    style={{ marginTop: 8 }}
                                  >
                                    <IconCheck size={14} />
                                    <span>
                                      Layanan prioritas aktif · Tambahan +Rp
                                      50.000
                                    </span>
                                  </div>
                                )}
                              </div>

                              <div className="field-stack">
                                <span className="field-label">
                                  Layanan waktu tunggu
                                </span>
                                <div
                                  className="floor-grid waiting-grid"
                                  role="radiogroup"
                                  aria-label="Layanan waktu tunggu"
                                >
                                  {waitingOptions.map((option) => {
                                    const selected = waitingTime === option.key;
                                    return (
                                      <button
                                        key={option.key}
                                        type="button"
                                        role="radio"
                                        aria-checked={selected}
                                        className={`floor-card waiting-card${selected ? " is-selected" : ""}`}
                                        onClick={() =>
                                          setWaitingTime(option.key)
                                        }
                                      >
                                        <span className="waiting-title">
                                          {option.title}
                                        </span>
                                        <span className="waiting-price">
                                          {option.price === 0
                                            ? "Gratis"
                                            : `+Rp${option.price.toLocaleString("id-ID")}`}
                                        </span>
                                        <span
                                          className="waiting-check"
                                          aria-hidden="true"
                                        >
                                          <IconCheck size={11} />
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                                <p className="floor-hint">
                                  Biaya tambahan bila armada menunggu di lokasi.
                                </p>
                              </div>
                            </section>
                          )}

                          {step === 4 && (
                            <section className="form-section">
                              <div className="section-head">
                                <span className="step-badge">4</span>
                                <div className="section-copy">
                                  <h3 id="wizard-step-title" tabIndex={-1}>
                                    Bantuan &amp; lantai
                                  </h3>
                                  <p>
                                    Pilih bantuan dan akses lantai di kedua
                                    titik.
                                  </p>
                                </div>
                              </div>

                              <div
                                className="option-list"
                                role="radiogroup"
                                aria-label="Bantuan bongkar muat"
                              >
                                {helperOptions.map((option) => {
                                  const OptionIcon = option.icon;
                                  return (
                                    <button
                                      key={option.key}
                                      type="button"
                                      role="radio"
                                      aria-checked={helper === option.key}
                                      className={`option-row${helper === option.key ? " is-selected" : ""}`}
                                      onClick={() => setHelper(option.key)}
                                    >
                                      <span className="option-icon">
                                        <OptionIcon size={18} />
                                      </span>
                                      <span className="option-main">
                                        <span className="option-title">
                                          {option.title}
                                        </span>
                                        <span className="option-desc">
                                          {option.description}
                                        </span>
                                      </span>
                                      <span className="option-price">
                                        {option.price === 0
                                          ? "Gratis"
                                          : `+Rp${option.price.toLocaleString("id-ID")}`}
                                      </span>
                                      <span className="option-check">
                                        <IconCheck size={12} />
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>

                              <div className="floor-grid">
                                {orderedStops.map((stop) => {
                                  const floor = floorOf(stop.id);
                                  const label = stopLabel(stop, stops);
                                  const fee = floorFee(floor);
                                  return (
                                    <div className="floor-card" key={stop.id}>
                                      <div className="floor-title">
                                        {label} · Lantai titik{" "}
                                        {STOP_KIND_LABEL[stop.kind]}
                                      </div>
                                      <div className="stepper">
                                        <button
                                          type="button"
                                          className="stepper-btn"
                                          aria-label={`Kurangi lantai ${label}`}
                                          onClick={() =>
                                            changeFloor(stop.id, floor - 1)
                                          }
                                          disabled={floor <= 1}
                                        >
                                          <IconMinus size={16} />
                                        </button>
                                        <div
                                          className="stepper-value"
                                          aria-live="polite"
                                        >
                                          {floor}
                                        </div>
                                        <button
                                          type="button"
                                          className="stepper-btn"
                                          aria-label={`Tambah lantai ${label}`}
                                          onClick={() =>
                                            changeFloor(stop.id, floor + 1)
                                          }
                                          disabled={floor >= 20}
                                        >
                                          <IconPlus size={16} />
                                        </button>
                                      </div>
                                      <p className="floor-hint">
                                        {floor === 1
                                          ? "Lantai dasar · Gratis"
                                          : `Lantai ${floor} · +Rp${fee.toLocaleString("id-ID")}`}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                              <p className="floor-hint">
                                Biaya lantai dihitung untuk setiap titik muat
                                dan bongkar.
                              </p>
                            </section>
                          )}

                          {step === 5 && (
                            <section className="form-section">
                              <div className="section-head">
                                <span className="step-badge">5</span>
                                <div className="section-copy">
                                  <h3 id="wizard-step-title" tabIndex={-1}>
                                    Catatan tambahan
                                  </h3>
                                  <p>
                                    Detail yang membantu tim kami di lapangan
                                    (opsional).
                                  </p>
                                </div>
                              </div>

                              <div className="field">
                                <div className="field-label-row">
                                  <label
                                    className="field-label"
                                    htmlFor="customer-note"
                                  >
                                    Catatan khusus
                                  </label>
                                  <span className="badge-optional">
                                    Opsional
                                  </span>
                                </div>
                                <div className="textarea-shell">
                                  <textarea
                                    id="customer-note"
                                    className="field-textarea"
                                    value={note}
                                    onChange={(event) =>
                                      setNote(event.target.value)
                                    }
                                    maxLength={300}
                                    rows={3}
                                    placeholder="Contoh: barang perlu ditutup terpal, ada tangga sempit, mohon datang jam 8 pagi."
                                  />
                                  <span className="char-count">
                                    {note.length}/300
                                  </span>
                                </div>

                                <div className="quick-suggestions">
                                  <span className="quick-suggestion-title">
                                    Saran catatan cepat:
                                  </span>
                                  {QUICK_NOTES.map((snippet) => (
                                    <button
                                      key={snippet}
                                      type="button"
                                      className="quick-suggestion-btn"
                                      onClick={() => appendQuickNote(snippet)}
                                    >
                                      + {snippet}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </section>
                          )}

                          {step === 6 && (
                            <section className="form-section">
                              <div className="section-head">
                                <span className="step-badge">6</span>
                                <div className="section-copy">
                                  <h3 id="wizard-step-title" tabIndex={-1}>
                                    Ringkasan estimasi
                                  </h3>
                                  <p>
                                    Periksa kembali rincian data dan estimasi
                                    ongkos sebelum kirim ke WhatsApp.
                                  </p>
                                </div>
                              </div>

                              {!allStopsSet && (
                                <div
                                  className="route-warning-banner"
                                  role="alert"
                                >
                                  <IconAlert size={20} />
                                  <div>
                                    <p>
                                      <strong>
                                        Titik rute di peta belum lengkap!
                                      </strong>
                                      <br />
                                      {orderedStops
                                        .filter((stop) => stop.lat === null)
                                        .map((stop) => stopLabel(stop, stops))
                                        .join(", ")}{" "}
                                      belum ditandai di peta. Tandai semua titik
                                      agar jarak &amp; ongkos otomatis dihitung.
                                    </p>
                                    <button
                                      type="button"
                                      className="btn-map-jump"
                                      onClick={() =>
                                        showRoute(
                                          orderedStops.find(
                                            (stop) => stop.lat === null,
                                          )?.kind ?? "load",
                                        )
                                      }
                                    >
                                      <IconMapPin
                                        size={14}
                                        style={{
                                          display: "inline",
                                          verticalAlign: "-2px",
                                          marginRight: 4,
                                        }}
                                      />
                                      Tandai titik di peta sekarang
                                    </button>
                                  </div>
                                </div>
                              )}

                              <div className="order-review-card">
                                <div className="review-section">
                                  <div className="review-section-head">
                                    <span className="review-section-title">
                                      Data Pemesan
                                    </span>
                                    <button
                                      type="button"
                                      className="review-edit-btn"
                                      onClick={() => goToStep(2)}
                                    >
                                      Ubah
                                    </button>
                                  </div>
                                  <dl className="review-rows">
                                    <div className="review-row">
                                      <dt>Nama pemesan</dt>
                                      <dd>{name || "—"}</dd>
                                    </div>
                                    <div className="review-row">
                                      <dt>Nomor HP / WhatsApp</dt>
                                      <dd>{phone || "—"}</dd>
                                    </div>
                                    <div className="review-row">
                                      <dt>Jadwal angkut</dt>
                                      <dd>
                                        {scheduleLabel ||
                                          "Dibicarakan lewat WhatsApp"}
                                      </dd>
                                    </div>
                                  </dl>
                                </div>

                                <div className="review-section">
                                  <div className="review-section-head">
                                    <span className="review-section-title">
                                      Rute Angkutan
                                    </span>
                                    <button
                                      type="button"
                                      className="review-edit-btn"
                                      onClick={() => showRoute("load")}
                                    >
                                      Peta
                                    </button>
                                  </div>
                                  <dl className="review-rows">
                                    {orderedStops.map((stop) => (
                                      <div className="review-row" key={stop.id}>
                                        <dt>
                                          {stopLabel(stop, stops)} ·{" "}
                                          {stop.kind === "load"
                                            ? "Muat"
                                            : "Bongkar"}
                                        </dt>
                                        <dd>
                                          {stop.lat !== null
                                            ? stop.address
                                            : "Belum dipilih di peta"}
                                        </dd>
                                      </div>
                                    ))}
                                    {quote && (
                                      <div className="review-row">
                                        <dt>Jarak total</dt>
                                        <dd>{quote.billableKm} km</dd>
                                      </div>
                                    )}
                                    <div className="review-row">
                                      <dt>Pengiriman</dt>
                                      <dd>
                                        {priority
                                          ? "Prioritas Langsung (ASAP, +Rp 50.000)"
                                          : "Reguler (Tiba maks. 4 jam)"}
                                      </dd>
                                    </div>
                                  </dl>
                                </div>

                                <div className="review-section">
                                  <div className="review-section-head">
                                    <span className="review-section-title">
                                      Layanan &amp; Bantuan
                                    </span>
                                    <button
                                      type="button"
                                      className="review-edit-btn"
                                      onClick={() => goToStep(3)}
                                    >
                                      Ubah
                                    </button>
                                  </div>
                                  <dl className="review-rows">
                                    <div className="review-row">
                                      <dt>Layanan</dt>
                                      <dd>{serviceLabel}</dd>
                                    </div>
                                    <div className="review-row">
                                      <dt>Bantuan tenaga</dt>
                                      <dd>{helperLabel}</dd>
                                    </div>
                                    {waitingTime !== "none" && (
                                      <div className="review-row">
                                        <dt>Waktu tunggu</dt>
                                        <dd>
                                          {`${waitingLabel} (+Rp ${(
                                            waitingOption?.price ?? 0
                                          ).toLocaleString("id-ID")})`}
                                        </dd>
                                      </div>
                                    )}
                                    <div className="review-row">
                                      <dt>Lantai muat</dt>
                                      <dd>
                                        {loadStops
                                          .map(
                                            (stop, index) =>
                                              `M${index + 1}: ${floorOf(stop.id)}`,
                                          )
                                          .join(" · ")}
                                      </dd>
                                    </div>
                                    <div className="review-row">
                                      <dt>Lantai bongkar</dt>
                                      <dd>
                                        {unloadStops
                                          .map(
                                            (stop, index) =>
                                              `B${index + 1}: ${floorOf(stop.id)}`,
                                          )
                                          .join(" · ")}
                                      </dd>
                                    </div>
                                    {note.trim() && (
                                      <div className="review-row">
                                        <dt>Catatan</dt>
                                        <dd>{note}</dd>
                                      </div>
                                    )}
                                  </dl>
                                </div>
                              </div>

                              <div
                                className="summary-block"
                                style={{
                                  marginTop: 0,
                                  paddingTop: 0,
                                  borderTop: 0,
                                }}
                              >
                                {quote ? (
                                  <div
                                    className="quote-card"
                                    aria-live="polite"
                                  >
                                    <div className="quote-head">
                                      <span className="quote-title">
                                        Rincian Estimasi Biaya
                                      </span>
                                      <span className="quote-badge">
                                        Estimasi
                                      </span>
                                    </div>
                                    <dl className="quote-lines">
                                      <div className="quote-line">
                                        <dt>Jarak total</dt>
                                        <dd>{quote.billableKm} km</dd>
                                      </div>
                                      {quote.outOfTownSurcharge > 0 ? (
                                        <>
                                          <div className="quote-line">
                                            <dt>Ongkos angkut dasar</dt>
                                            <dd>
                                              Rp{" "}
                                              {quote.baseTransport.toLocaleString(
                                                "id-ID",
                                              )}
                                            </dd>
                                          </div>
                                          <div className="quote-line">
                                            <dt>Tambahan luar kota (+50%)</dt>
                                            <dd>
                                              +Rp{" "}
                                              {quote.outOfTownSurcharge.toLocaleString(
                                                "id-ID",
                                              )}
                                            </dd>
                                          </div>
                                        </>
                                      ) : (
                                        <div className="quote-line">
                                          <dt>Ongkos angkut</dt>
                                          <dd>
                                            Rp{" "}
                                            {quote.transport.toLocaleString(
                                              "id-ID",
                                            )}
                                          </dd>
                                        </div>
                                      )}
                                      {quote.helper > 0 && (
                                        <div className="quote-line">
                                          <dt>Bantuan bongkar muat</dt>
                                          <dd>
                                            Rp{" "}
                                            {quote.helper.toLocaleString(
                                              "id-ID",
                                            )}
                                          </dd>
                                        </div>
                                      )}
                                      {quote.loadFloor > 0 && (
                                        <div className="quote-line">
                                          <dt>
                                            Lantai muat
                                            {loadStops.length > 1
                                              ? ` (${loadStops.length} titik)`
                                              : ""}
                                          </dt>
                                          <dd>
                                            Rp{" "}
                                            {quote.loadFloor.toLocaleString(
                                              "id-ID",
                                            )}
                                          </dd>
                                        </div>
                                      )}
                                      {quote.unloadFloor > 0 && (
                                        <div className="quote-line">
                                          <dt>
                                            Lantai bongkar
                                            {unloadStops.length > 1
                                              ? ` (${unloadStops.length} titik)`
                                              : ""}
                                          </dt>
                                          <dd>
                                            Rp{" "}
                                            {quote.unloadFloor.toLocaleString(
                                              "id-ID",
                                            )}
                                          </dd>
                                        </div>
                                      )}
                                      {quote.priority > 0 && (
                                        <div className="quote-line">
                                          <dt>Prioritas pengiriman</dt>
                                          <dd>
                                            Rp{" "}
                                            {quote.priority.toLocaleString(
                                              "id-ID",
                                            )}
                                          </dd>
                                        </div>
                                      )}
                                      {quote.waitingTime > 0 && (
                                        <div className="quote-line">
                                          <dt>Waktu tunggu ({waitingLabel})</dt>
                                          <dd>
                                            Rp{" "}
                                            {quote.waitingTime.toLocaleString(
                                              "id-ID",
                                            )}
                                          </dd>
                                        </div>
                                      )}
                                    </dl>
                                    <div className="quote-total">
                                      <span>Total estimasi</span>
                                      <strong>
                                        Rp {quote.total.toLocaleString("id-ID")}
                                      </strong>
                                    </div>
                                    <p className="quote-note">
                                      Harga final dikonfirmasi oleh Jasa Angkut
                                      Slamet lewat WhatsApp.
                                    </p>
                                  </div>
                                ) : (
                                  <div className="quote-empty">
                                    <span className="empty-icon">
                                      <IconReceipt size={19} />
                                    </span>
                                    <div className="empty-copy">
                                      <strong>Harga belum bisa dihitung</strong>
                                      <p>
                                        {missing.length > 0
                                          ? `Lengkapi ${missing.join(", ").toLowerCase()} untuk melihat estimasi.`
                                          : "Periksa kembali data pesanan Anda."}
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="submit-area">
                                {waUrl ? (
                                  <a
                                    className="btn btn-primary btn-lg btn-block"
                                    href={waUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <IconWhatsApp size={20} />
                                    Kirim pesanan ke WhatsApp
                                  </a>
                                ) : (
                                  <button
                                    className="btn btn-primary btn-lg btn-block"
                                    disabled
                                  >
                                    <IconWhatsApp size={20} />
                                    Kirim pesanan ke WhatsApp
                                  </button>
                                )}
                                <p className="submit-note">
                                  <IconLock size={14} />
                                  Data hanya dikirim saat Anda menekan tombol.
                                </p>
                                {!waUrl && (
                                  <p className="submit-reason">
                                    Lengkapi{" "}
                                    {missing.join(", ").toLowerCase() ||
                                      "data pesanan"}{" "}
                                    untuk mengaktifkan tombol.
                                  </p>
                                )}
                              </div>
                            </section>
                          )}
                        </div>

                        <div className="wizard-actions booking-tab-actions">
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={step === 1 ? closeBooking : goBack}
                          >
                            {step > 1 && <IconArrowLeft size={18} />}
                            <span>{step === 1 ? "Tutup" : "Kembali"}</span>
                          </button>
                          {quote && (
                            <div className="booking-tab-price">
                              <span className="booking-tab-price-label">
                                Estimasi
                              </span>
                              <strong>
                                Rp {quote.total.toLocaleString("id-ID")}
                              </strong>
                            </div>
                          )}
                          {step < wizardSteps.length && (
                            <button
                              type="button"
                              className="btn btn-primary wizard-actions-right"
                              onClick={advance}
                            >
                              <span>Lanjut</span>
                              <IconArrowRight size={18} />
                            </button>
                          )}
                        </div>
                      </div>
                    </section>
                  </section>
                </>
              )}
              <div className="hero-content hero-content-centered">
                <div className="hero-pill-badge">
                  <span className="hero-pill-star">★</span>
                  <span>
                    Jasa Angkut Slamet Kebonbatur, Mranggen, Demak, Kota
                    Semarang, Kab. Semarang
                  </span>
                </div>
                <h1 className="hero-title" id="hero-title">
                  Pindahan Lebih Tenang,{" "}
                  <span>Barang Sampai dengan Aman &amp; Tepat Waktu.</span>
                </h1>
                <p className="hero-lead">
                  Layanan armada pick up handal untuk pindahan rumah, kos,
                  kantor, hingga distribusi barang dagangan se-Demak, Semarang,
                  dan sekitarnya. Tarif transparan di awal, respon cepat &lt; 5
                  menit!
                </p>

                <div className="hero-cta">
                  <a
                    className="btn btn-primary btn-lg"
                    href={waChatUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <IconWhatsApp size={18} />
                    <span>Pesan via WhatsApp</span>
                  </a>
                  <button
                    type="button"
                    className="btn btn-secondary btn-lg"
                    onClick={() => setBookingOpen(true)}
                  >
                    <span>Hitung Tarif Sekarang</span>
                    <IconArrowRight size={18} />
                  </button>
                </div>

                <div className="hero-trust-cards" aria-label="Keunggulan Utama">
                  <div className="trust-card">
                    <div className="trust-icon">
                      <IconReceipt size={18} />
                    </div>
                    <div>
                      <div className="trust-title">Tarif Jelas di Awal</div>
                      <div className="trust-desc">Tanpa biaya siluman</div>
                    </div>
                  </div>
                  <div className="trust-card">
                    <div className="trust-icon">
                      <IconUsers size={18} />
                    </div>
                    <div>
                      <div className="trust-title">Bantu Angkat Muat</div>
                      <div className="trust-desc">
                        Opsi sopir / kenek angkut
                      </div>
                    </div>
                  </div>
                  <div className="trust-card">
                    <div className="trust-icon">
                      <IconClock size={18} />
                    </div>
                    <div>
                      <div className="trust-title">Respon &lt; 5 Menit</div>
                      <div className="trust-desc">
                        Admin siaga &amp; solutif
                      </div>
                    </div>
                  </div>
                  <div className="trust-card">
                    <div className="trust-icon">
                      <IconCheck size={18} />
                    </div>
                    <div>
                      <div className="trust-title">Terpal &amp; Tali Aman</div>
                      <div className="trust-desc">Standar cuaca hujan</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="hero-visual-col">
                <figure className="hero-visual-card">
                  <div className="hero-visual-media">
                    <picture>
                      <source
                        type="image/avif"
                        srcSet="/galeri-jasa-angkut-slamet-1-800.avif 800w, /galeri-jasa-angkut-slamet-1-1200.avif 1200w"
                        sizes="(min-width: 900px) 440px, 100vw"
                      />
                      <source
                        type="image/webp"
                        srcSet="/galeri-jasa-angkut-slamet-1-800.webp 800w, /galeri-jasa-angkut-slamet-1-1200.webp 1200w"
                        sizes="(min-width: 900px) 440px, 100vw"
                      />
                      <img
                        src="/galeri-jasa-angkut-slamet-1-800.jpg"
                        srcSet="/galeri-jasa-angkut-slamet-1-800.jpg 800w, /galeri-jasa-angkut-slamet-1-1200.jpg 1200w"
                        sizes="(min-width: 900px) 440px, 100vw"
                        alt="Armada Jasa Angkut Slamet untuk angkutan barang dan pindahan di Demak dan Semarang"
                        width={1200}
                        height={1800}
                        loading="eager"
                        {...({ fetchpriority: "high" } as Record<
                          string,
                          string
                        >)}
                        decoding="async"
                      />
                    </picture>
                    <div className="hero-chip-floating">
                      <span className="hero-chip-star">⭐</span>
                      <span className="hero-chip-divider">·</span>
                      <span>100+ Trip Sukses</span>
                    </div>
                  </div>
                  <figcaption className="hero-visual-footer">
                    <div className="hero-visual-tag">
                      <IconTruck size={15} />
                      <span>Armada Siaga Hari Ini</span>
                    </div>
                    <div className="hero-visual-rate">
                      <div className="rate-num">
                        Rp 7.000 <span className="rate-unit">/km</span>
                      </div>
                      <div className="rate-driver">
                        + Jasa Sopir Tetap Rp 50.000
                      </div>
                    </div>
                    <p className="hero-visual-subnote">
                      Perhitungan tarif otomatis transparan langsung di rute
                      peta. Konfirmasi via WhatsApp sebelum berangkat.
                    </p>
                  </figcaption>
                </figure>
              </div>
            </div>
          </div>
        </section>

        <section
          className="services"
          id="layanan"
          aria-labelledby="layanan-title"
        >
          <div className="container">
            <div className="section-intro">
              <span className="eyebrow">
                <span className="eyebrow-dot" />
                Layanan
              </span>
              <h2 className="section-title" id="layanan-title">
                Satu tim untuk kebutuhan angkut dan pindahan
              </h2>
              <p className="section-lead">
                Pilih layanan yang paling dekat dengan kebutuhan Anda. Armada,
                sopir, dan bantuan bongkar muat disiapkan sesuai muatan.
              </p>
            </div>

            <div className="service-grid">
              <article className="service-card">
                <div>
                  <span className="service-pill">Paling Diminati</span>
                </div>
                <span className="service-icon">
                  <IconBuilding size={22} />
                </span>
                <h3 className="service-title">Pindahan Rumah &amp; Kost</h3>
                <p className="service-desc">
                  Perabot, kasur, lemari, dan barang perabotan diangkut rapi
                  dengan terpal serta tali tambang kuat.
                </p>
                <a className="service-link" href="#pesan">
                  Hitung tarif pindahan
                  <IconArrowRight size={16} />
                </a>
              </article>

              <article className="service-card">
                <div>
                  <span className="service-pill">Hemat Mahasiswa</span>
                </div>
                <span className="service-icon">
                  <IconGrid size={22} />
                </span>
                <h3 className="service-title">Pindahan Kos &amp; Kontrakan</h3>
                <p className="service-desc">
                  Pindahan kos praktis dan hemat untuk mahasiswa/karyawan. Rute
                  fleksibel dengan tenaga sopir siap bantu angkat.
                </p>
                <a className="service-link" href="#pesan">
                  Hitung tarif kos
                  <IconArrowRight size={16} />
                </a>
              </article>

              <article className="service-card">
                <div>
                  <span className="service-pill">Distribusi Cepat</span>
                </div>
                <span className="service-icon">
                  <IconBox size={22} />
                </span>
                <h3 className="service-title">Angkut Barang Dagangan</h3>
                <p className="service-desc">
                  Stok toko, etalase, bahan baku, suplai berkala antar cabang di
                  Demak, Semarang, dan sekitarnya tepat waktu.
                </p>
                <a className="service-link" href="#pesan">
                  Hitung tarif dagangan
                  <IconArrowRight size={16} />
                </a>
              </article>

              <article className="service-card">
                <div>
                  <span className="service-pill">Kapasitas Besar</span>
                </div>
                <span className="service-icon">
                  <IconUsers size={22} />
                </span>
                <h3 className="service-title">Kargo, Event &amp; Mesin</h3>
                <p className="service-desc">
                  Perlengkapan pameran, genset, material bangunan, hingga mesin
                  produksi ringan dengan daya angkut hingga 1.5 ton.
                </p>
                <a className="service-link" href="#pesan">
                  Hitung tarif kargo
                  <IconArrowRight size={16} />
                </a>
              </article>
            </div>
          </div>
        </section>

        {/* Google Stitch: Alur Pemesanan */}
        <section
          className="how-section"
          id="cara-pesan"
          aria-labelledby="how-title"
        >
          <div className="container">
            <div className="section-intro">
              <span className="eyebrow">
                <span className="eyebrow-dot" />
                Alur Pemesanan Praktis
              </span>
              <h2 className="section-title" id="how-title">
                Empat Langkah, Armada Langsung Berangkat
              </h2>
              <p className="section-lead">
                Tanpa perlu instal aplikasi rumit atau buat akun. Semua proses
                transparan, mudah diakses, dan dikonfirmasi langsung via
                WhatsApp.
              </p>
            </div>

            <ol className="how-grid">
              <li className="how-step">
                <span className="how-num">1</span>
                <h3>Tentukan Lokasi di Peta</h3>
                <p>
                  Tandai titik jemput muat &amp; alamat bongkar di peta
                  interaktif, atau ketik alamat tujuan Anda.
                </p>
              </li>
              <li className="how-step">
                <span className="how-num">2</span>
                <h3>Pilih Kebutuhan Layanan</h3>
                <p>
                  Tentukan jenis muatan, opsi tenaga angkut (sopir/kenek), dan
                  info lantai bila ada tangga bertingkat.
                </p>
              </li>
              <li className="how-step">
                <span className="how-num">3</span>
                <h3>Kalkulasi Tarif Pasti</h3>
                <p>
                  Tarif jarak km, jasa sopir tetap, dan tenaga bantuan terhitung
                  otomatis dan transparan tanpa biaya siluman.
                </p>
              </li>
              <li className="how-step">
                <span className="how-num">4</span>
                <h3>Deal &amp; Armada Meluncur</h3>
                <p>
                  Kirim ringkasan otomatis ke WhatsApp. Admin langsung
                  mengonfirmasi dan armada meluncur tepat waktu.
                </p>
              </li>
            </ol>
          </div>
        </section>

        {/* Google Stitch: Spesifikasi Armada & Keunggulan Bento */}
        <section
          className="fleet-section"
          id="kenapa"
          aria-labelledby="why-title"
        >
          <div className="container">
            <div className="section-intro">
              <span className="eyebrow">
                <span className="eyebrow-dot" />
                Armada &amp; Keunggulan
              </span>
              <h2 className="section-title" id="why-title">
                Spesifikasi Armada Pick Up &amp; Layanan Terpercaya
              </h2>
              <p className="section-lead">
                Armada pick up prima, bersih, dan dilengkapi perlengkapan
                pengamanan lengkap untuk menjamin barang Anda sampai dengan aman
                dan utuh.
              </p>
            </div>

            <div className="fleet-bento-grid">
              {/* Left Column: Fleet Specs Bento Card */}
              <div className="fleet-card">
                <div className="fleet-image-wrap">
                  <img
                    src="/galeri-jasa-angkut-slamet-1-800.jpg"
                    alt="Armada Pick Up Jasa Angkut Slamet"
                    loading="lazy"
                  />
                </div>
                <h3 className="fleet-card-title">
                  Spesifikasi Standar Pick Up Bak Terbuka
                </h3>
                <ul className="fleet-specs-list">
                  <li className="fleet-spec-row">
                    <span className="fleet-spec-label">
                      <IconTruck size={16} />
                      Dimensi Bak Muatan
                    </span>
                    <span className="fleet-spec-value">
                      2,45m (P) × 1,55m (L) × 1,30m (T)
                    </span>
                  </li>
                  <li className="fleet-spec-row">
                    <span className="fleet-spec-label">
                      <IconBox size={16} />
                      Kapasitas Muat Maksimal
                    </span>
                    <span className="fleet-spec-value">
                      1.200 – 1.500 kg (Aman)
                    </span>
                  </li>
                  <li className="fleet-spec-row">
                    <span className="fleet-spec-label">
                      <IconCheck size={16} />
                      Proteksi Cuaca &amp; Hujan
                    </span>
                    <span className="fleet-spec-value">Terpal</span>
                  </li>
                  <li className="fleet-spec-row">
                    <span className="fleet-spec-label">
                      <IconRoute size={16} />
                      Standar Pengikat Muatan
                    </span>
                    <span className="fleet-spec-value">Tali Tambang</span>
                  </li>
                </ul>
              </div>

              {/* Right Column: 4 Key Advantages */}
              <div className="why-bento-grid">
                <article className="why-bento-card">
                  <span className="why-bento-icon">
                    <IconReceipt size={20} />
                  </span>
                  <h3>Tarif Transparan Tanpa Siluman</h3>
                  <p>
                    Biaya per kilometer jelas, jasa sopir tetap Rp 50.000, tanpa
                    pungutan liar tak terduga di jalan.
                  </p>
                </article>

                <article className="why-bento-card">
                  <span className="why-bento-icon">
                    <IconClock size={20} />
                  </span>
                  <h3>100% On-Time &amp; Paham Rute</h3>
                  <p>
                    Sopir berpengalaman hafal jalur arteri maupun alternatif di
                    Demak, Semarang Kota, hingga Ungaran.
                  </p>
                </article>

                <article className="why-bento-card">
                  <span className="why-bento-icon">
                    <IconUsers size={20} />
                  </span>
                  <h3>Tenaga Bantuan Siaga</h3>
                  <p>
                    Pilihan bantuan bongkar muat fleksibel: sopir ikut angkut
                    atau sopir + kenek untuk perabot berat.
                  </p>
                </article>

                <article className="why-bento-card">
                  <span className="why-bento-icon">
                    <IconWhatsApp size={20} />
                  </span>
                  <h3>Respon Kilat Setiap Hari</h3>
                  <p>
                    Buka setiap hari 06.00 – 22.00 WIB. Chat WhatsApp dibalas
                    langsung di bawah 5 menit.
                  </p>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section className="gallery" id="galeri" aria-labelledby="galeri-title">
          <div className="gallery-head">
            <div>
              <span className="eyebrow">
                <span className="eyebrow-dot" />
                Galeri
              </span>
              <h2 className="gallery-title" id="galeri-title">
                Armada dan aktivitas angkut
              </h2>
              <p className="gallery-lead">
                Dokumentasi armada, proses bongkar muat, dan pengiriman barang
                Jasa Angkut Slamet di Demak, Semarang, dan sekitarnya.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary gallery-open"
              onClick={() => setGalleryOpen(true)}
              ref={galleryTriggerRef}
              aria-haspopup="dialog"
            >
              <IconGrid size={18} />
              <span>Lihat semua foto</span>
            </button>
          </div>
          <div
            className="gallery-carousel"
            role="region"
            aria-roledescription="carousel"
            aria-label="Galeri Jasa Angkut Slamet"
            tabIndex={0}
            onKeyDown={handleGalleryKeyDown}
          >
            <div className="gallery-viewport">
              <ul
                className="gallery-track"
                ref={galleryTrackRef}
                onScroll={handleGalleryScroll}
              >
                {GALLERY.map((item, index) => (
                  <li className="gallery-slide" key={item.base}>
                    <div
                      role="group"
                      aria-roledescription="slide"
                      aria-label={`${index + 1} dari ${GALLERY.length}`}
                    >
                      <a
                        className="gallery-link"
                        href={`/${item.base}-1200.jpg`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Buka foto: ${item.caption}`}
                      >
                        <picture>
                          <source
                            type="image/avif"
                            srcSet={`/${item.base}-480.avif 480w, /${item.base}-800.avif 800w, /${item.base}-1200.avif 1200w`}
                            sizes="(min-width: 640px) 560px, 100vw"
                          />
                          <source
                            type="image/webp"
                            srcSet={`/${item.base}-480.webp 480w, /${item.base}-800.webp 800w, /${item.base}-1200.webp 1200w`}
                            sizes="(min-width: 640px) 560px, 100vw"
                          />
                          <img
                            src={`/${item.base}-800.jpg`}
                            srcSet={`/${item.base}-480.jpg 480w, /${item.base}-800.jpg 800w, /${item.base}-1200.jpg 1200w`}
                            sizes="(min-width: 640px) 560px, 100vw"
                            alt={item.alt}
                            width={item.width}
                            height={item.height}
                            loading={index === 0 ? "eager" : "lazy"}
                            decoding="async"
                          />
                        </picture>
                      </a>
                    </div>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                className="gallery-nav gallery-nav-prev"
                onClick={() => scrollGalleryTo(galleryIndex - 1)}
                aria-label="Foto sebelumnya"
              >
                <IconArrowLeft size={18} />
              </button>
              <button
                type="button"
                className="gallery-nav gallery-nav-next"
                onClick={() => scrollGalleryTo(galleryIndex + 1)}
                aria-label="Foto berikutnya"
              >
                <IconArrowRight size={18} />
              </button>

              <div className="gallery-dots">
                {GALLERY.map((item, index) => (
                  <button
                    type="button"
                    className={
                      index === galleryIndex
                        ? "gallery-dot is-active"
                        : "gallery-dot"
                    }
                    key={item.base}
                    onClick={() => scrollGalleryTo(index)}
                    aria-label={`Ke foto ${index + 1}: ${item.caption}`}
                    aria-current={index === galleryIndex}
                  />
                ))}
              </div>
            </div>

            <div className="gallery-caption-row">
              <p className="gallery-caption" aria-live="polite">
                {GALLERY[galleryIndex].caption}
              </p>
              <p className="gallery-counter" aria-hidden="true">
                {galleryIndex + 1} / {GALLERY.length}
              </p>
            </div>
          </div>

          {galleryOpen && (
            <>
              <div
                className="gallery-modal-backdrop"
                onClick={() => setGalleryOpen(false)}
                aria-hidden="true"
              />
              <div
                className="gallery-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="gallery-modal-title"
                ref={galleryModalRef}
              >
                <div className="gallery-modal-head">
                  <div>
                    <h3 id="gallery-modal-title">Galeri Jasa Angkut Slamet</h3>
                    <p>
                      {GALLERY.length} foto armada dan aktivitas angkut. Klik
                      foto untuk membuka ukuran penuh.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="gallery-modal-close"
                    onClick={() => setGalleryOpen(false)}
                    aria-label="Tutup galeri"
                  >
                    <IconX size={20} />
                  </button>
                </div>
                <div className="gallery-modal-body">
                  <ul className="gallery-modal-grid">
                    {GALLERY.map((item) => (
                      <li key={item.base}>
                        <a
                          className="gallery-modal-item"
                          href={`/${item.base}-1200.jpg`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <picture>
                            <source
                              type="image/avif"
                              srcSet={`/${item.base}-480.avif 480w, /${item.base}-800.avif 800w`}
                              sizes="(min-width: 900px) 280px, 45vw"
                            />
                            <source
                              type="image/webp"
                              srcSet={`/${item.base}-480.webp 480w, /${item.base}-800.webp 800w`}
                              sizes="(min-width: 900px) 280px, 45vw"
                            />
                            <img
                              src={`/${item.base}-480.jpg`}
                              srcSet={`/${item.base}-480.jpg 480w, /${item.base}-800.jpg 800w`}
                              sizes="(min-width: 900px) 280px, 45vw"
                              alt={item.alt}
                              width={item.width}
                              height={item.height}
                              loading="lazy"
                              decoding="async"
                            />
                          </picture>
                          <span className="gallery-modal-caption">
                            {item.caption}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}
        </section>

        <section
          className="area-section"
          id="area-layanan"
          aria-labelledby="area-title"
        >
          <div className="area-shell">
            <div className="area-head">
              <span className="eyebrow">
                <span className="eyebrow-dot" />
                49 Kecamatan
              </span>
              <h2 className="area-title" id="area-title">
                Area layanan jasa angkut Demak, Semarang &amp; Kabupaten
                Semarang
              </h2>
              <p className="area-lead">
                Kami melayani angkut barang dan pindahan ke seluruh kecamatan di
                Kabupaten Demak, Kota Semarang, dan Kabupaten Semarang. Cek
                daftar lengkapnya di bawah, lalu hitung tarif langsung dari
                peta.
              </p>
            </div>

            <div className="area-grid">
              {SERVICE_AREAS.map((area) => (
                <article className="area-coverage-card" key={area.title}>
                  <div className="area-coverage-head">
                    <span className="area-coverage-icon">
                      <IconMapPin size={18} />
                    </span>
                    <div>
                      <h3 className="area-coverage-title">{area.title}</h3>
                      <p className="area-coverage-meta">
                        {area.districts.length} kecamatan
                      </p>
                    </div>
                  </div>
                  <p className="area-coverage-desc">{area.description}</p>
                  <ul
                    className="hero-points area-points"
                    aria-label={`Kecamatan di ${area.title}`}
                  >
                    {area.districts.map((district) => (
                      <li key={district}>
                        <button
                          type="button"
                          className="hero-point"
                          title={`Layanan jasa angkut & pindahan area ${district} — Klik untuk hitung tarif`}
                          onClick={() => {
                            const el = document.getElementById("pesan");
                            if (el) {
                              el.scrollIntoView({ behavior: "smooth" });
                            }
                          }}
                        >
                          <IconCheck size={16} />
                          {district}
                        </button>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            <div className="out-of-town-banner">
              <div className="out-of-town-text">
                <IconRoute
                  size={18}
                  style={{
                    display: "inline-block",
                    verticalAlign: "middle",
                    marginRight: 8,
                    color: "var(--forest)",
                  }}
                />
                <span>
                  Butuh kirim ke luar kota di Jawa Tengah / antar kota? Hubungi
                  kami untuk penawaran tarif khusus rute antar kota.
                </span>
              </div>
              <a
                className="btn btn-primary btn-sm"
                href={waChatUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <IconWhatsApp size={16} />
                <span>Konsultasi Luar Kota</span>
              </a>
            </div>
          </div>
        </section>

        <section className="faq-section" id="faq" aria-labelledby="faq-title">
          <div className="faq-card">
            <div className="faq-head">
              <span className="eyebrow">
                <span className="eyebrow-dot" />
                Tanya Jawab
              </span>
              <h2 className="faq-title" id="faq-title">
                Pertanyaan yang sering diajukan
              </h2>
              <p className="faq-lead">
                Semua info penting seputar layanan angkutan barang dan pindahan
                Jasa Angkut Slamet.
              </p>
            </div>

            <div className="faq-grid">
              <details className="faq-item" open>
                <summary className="faq-question">
                  <span>Berapa tarif jasa angkut Jasa Angkut Slamet?</span>
                  <span className="faq-chevron" aria-hidden="true">
                    <IconPlus size={18} className="icon-open" />
                    <IconMinus size={18} className="icon-close" />
                  </span>
                </summary>
                <div className="faq-answer">
                  <p>
                    Tarif dihitung dari total jarak{" "}
                    <strong>
                      garasi → titik muat → titik bongkar → garasi
                    </strong>
                    , dibulatkan ke atas per km. Ongkos angkut = jarak ×{" "}
                    <strong>Rp 7.000</strong> + biaya dasar{" "}
                    <strong>Rp 50.000</strong>; rute luar kota ditambah 50%.
                    Setelah itu baru biaya layanan yang Anda pilih: bantuan
                    tenaga Rp 65.000 (sopir) atau Rp 130.000 (sopir + kenek),
                    biaya lantai, prioritas, dan waktu tunggu. Kalkulator di
                    halaman ini menghitung semuanya otomatis.
                  </p>
                </div>
              </details>

              <details className="faq-item">
                <summary className="faq-question">
                  <span>Wilayah mana saja yang dilayani?</span>
                  <span className="faq-chevron" aria-hidden="true">
                    <IconPlus size={18} className="icon-open" />
                    <IconMinus size={18} className="icon-close" />
                  </span>
                </summary>
                <div className="faq-answer">
                  <p>
                    Kami melayani{" "}
                    <strong>
                      seluruh kecamatan di Kabupaten Demak, Kota Semarang, dan
                      Kabupaten Semarang
                    </strong>
                    , termasuk Mranggen, Kebonbatur, Sayung, Ungaran, Ambarawa,
                    Bawen, dan Bandungan.{" "}
                    <a href="#area-layanan">
                      Lihat daftar lengkap area layanan
                    </a>
                    . Kami juga siap melayani pengiriman{" "}
                    <strong>Luar Kota</strong> (Jawa Tengah &amp; antar-kota
                    lainnya) dengan sistem rute pulang-pergi terhitung dari
                    garasi.
                  </p>
                </div>
              </details>

              <details className="faq-item">
                <summary className="faq-question">
                  <span>Bagaimana cara memesan jasa angkut?</span>
                  <span className="faq-chevron" aria-hidden="true">
                    <IconPlus size={18} className="icon-open" />
                    <IconMinus size={18} className="icon-close" />
                  </span>
                </summary>
                <div className="faq-answer">
                  <p>Sangat mudah tanpa perlu download aplikasi:</p>
                  <ol className="faq-steps">
                    <li>
                      Tentukan titik muat dan titik bongkar di peta (bisa lebih
                      dari satu titik).
                    </li>
                    <li>
                      Pilih jenis layanan, opsi bantuan tenaga, dan lantai
                      bangunan.
                    </li>
                    <li>
                      Klik tombol <strong>Kirim pesanan ke WhatsApp</strong>{" "}
                      untuk konfirmasi jadwal langsung dengan sopir kami.
                    </li>
                  </ol>
                </div>
              </details>

              <details className="faq-item">
                <summary className="faq-question">
                  <span>Apakah tersedia bantuan tenaga bongkar muat?</span>
                  <span className="faq-chevron" aria-hidden="true">
                    <IconPlus size={18} className="icon-open" />
                    <IconMinus size={18} className="icon-close" />
                  </span>
                </summary>
                <div className="faq-answer">
                  <p>Ya, kami menyediakan 3 pilihan sesuai kebutuhan Anda:</p>
                  <ul>
                    <li>
                      <strong>Bongkar muat sendiri:</strong> Gratis, barang
                      diserahkan di depan armada.
                    </li>
                    <li>
                      <strong>Sopir ikut bongkar muat:</strong> Tambahan Rp
                      65.000 (1 tenaga bantuan).
                    </li>
                    <li>
                      <strong>Sopir + Kenek:</strong> Tambahan Rp 130.000 (2
                      tenaga bantuan untuk barang banyak/berat).
                    </li>
                  </ul>
                </div>
              </details>

              <details className="faq-item">
                <summary className="faq-question">
                  <span>Apakah barang saya aman selama perjalanan?</span>
                  <span className="faq-chevron" aria-hidden="true">
                    <IconPlus size={18} className="icon-open" />
                    <IconMinus size={18} className="icon-close" />
                  </span>
                </summary>
                <div className="faq-answer">
                  <p>
                    Tentu aman. Armada kami selalu dilengkapi tali pengikat kuat
                    dan terpal penutup anti hujan/debu untuk melindungi muatan
                    perabotan rumah, kos, motor, maupun material usaha Anda.
                  </p>
                </div>
              </details>

              <details className="faq-item">
                <summary className="faq-question">
                  <span>Kapan jam operasional Jasa Angkut Slamet?</span>
                  <span className="faq-chevron" aria-hidden="true">
                    <IconPlus size={18} className="icon-open" />
                    <IconMinus size={18} className="icon-close" />
                  </span>
                </summary>
                <div className="faq-answer">
                  <p>
                    Kami melayani pengiriman setiap hari dari pukul{" "}
                    <strong>06:00 sampai 22:00 WIB</strong>. Untuk pengiriman
                    malam hari atau dini hari, silakan komunikasikan terlebih
                    dahulu via WhatsApp agar jadwal armada dapat dipersiapkan.
                  </p>
                </div>
              </details>
            </div>

            <div className="faq-foot">
              <span>Masih ada pertanyaan seputar muatan atau rute?</span>
              <a
                className="btn btn-secondary btn-sm"
                href={waChatUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <IconWhatsApp size={16} />
                <span>Tanya langsung via WhatsApp</span>
              </a>
            </div>
          </div>
        </section>

        <section
          className="cta-section"
          id="hubungi"
          aria-labelledby="cta-title"
        >
          <div className="container">
            <div className="cta-band">
              <div className="cta-copy">
                <span className="cta-eyebrow">Hubungi Kami</span>
                <h2 className="cta-title" id="cta-title">
                  Siap Pindahan atau Angkut Barang Hari Ini?
                </h2>
                <p className="cta-lead">
                  Konsultasikan kebutuhan armada dan waktu angkut Anda sekarang.
                  Admin siaga membalas dalam hitungan menit untuk konfirmasi
                  jadwal dan penawaran tarif terbaik.
                </p>
                <ul className="cta-points">
                  <li>
                    <IconCheck size={15} />
                    Tanpa perlu aplikasi
                  </li>
                  <li>
                    <IconCheck size={15} />
                    Respon cepat &lt; 5 menit
                  </li>
                  <li>
                    <IconCheck size={15} />
                    Buka setiap hari 06.00 – 22.00 WIB
                  </li>
                </ul>
              </div>
              <div className="cta-actions">
                <a
                  className="btn btn-whatsapp-cta btn-lg"
                  href={waChatUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <IconWhatsApp size={18} />
                  <span>Pesan via WhatsApp</span>
                </a>
                <a
                  className="btn btn-phone-cta btn-lg"
                  href={`tel:+${BUSINESS.whatsapp}`}
                >
                  <IconPhone size={18} />
                  <span>Telepon Langsung</span>
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer" id="kontak">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand-col">
              <a
                className="brand"
                href="#beranda"
                aria-label="Jasa Angkut Slamet — beranda"
              >
                <span className="brand-mark">
                  <IconTruck size={23} />
                </span>
                <span>
                  <span className="brand-name">Jasa Angkut Slamet</span>
                  <span className="brand-meta">
                    Armada Pindahan &amp; Logistik
                  </span>
                </span>
              </a>
              <p className="footer-desc">
                Solusi armada pick up terpercaya untuk angkutan barang, pindahan
                rumah, kos, kantor, dan distribusi logistik di Demak, Kota
                Semarang, dan Kab. Semarang.
              </p>
              <div className="footer-info-list">
                <div className="footer-info-item">
                  <IconMapPin size={16} />
                  <span>{BUSINESS.garage.address}</span>
                </div>
                <div className="footer-info-item">
                  <IconClock size={16} />
                  <span>Buka Setiap Hari: 06.00 – 22.00 WIB</span>
                </div>
              </div>
            </div>

            <div className="footer-nav-col">
              <h3 className="footer-col-title">Navigasi</h3>
              <ul className="footer-links-list">
                <li>
                  <a href="#beranda">Beranda</a>
                </li>
                <li>
                  <a href="#layanan">Layanan Kami</a>
                </li>
                <li>
                  <a href="#pesan">Kalkulator Tarif</a>
                </li>
                <li>
                  <a href="#galeri">Galeri Armada</a>
                </li>
                <li>
                  <a href="#area-layanan">Area Layanan</a>
                </li>
                <li>
                  <a href="#faq">Tanya Jawab (FAQ)</a>
                </li>
              </ul>
            </div>

            <div className="footer-area-col">
              <h3 className="footer-col-title">Area Layanan</h3>
              <ul className="footer-links-list">
                <li>
                  <a href="#area-layanan">Kabupaten Demak (14 Kec.)</a>
                </li>
                <li>
                  <a href="#area-layanan">Kota Semarang (16 Kec.)</a>
                </li>
                <li>
                  <a href="#area-layanan">Kab. Semarang (19 Kec.)</a>
                </li>
                <li>
                  <a href="#area-layanan">Ungaran &amp; Mranggen</a>
                </li>
                <li>
                  <a href="#hubungi">Kirim Antar Kota &amp; Provinsi</a>
                </li>
              </ul>
            </div>

            <div className="footer-contact-col">
              <h3 className="footer-col-title">Kontak &amp; Sosial</h3>
              <div className="footer-contact-actions">
                <a
                  className="footer-btn-wa"
                  href={waChatUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Chat WhatsApp Admin Jasa Angkut Slamet"
                >
                  <IconWhatsApp size={16} />
                  <span>0813-2762-3942</span>
                </a>
                <a
                  className="footer-btn-phone"
                  href={`tel:+${BUSINESS.whatsapp}`}
                  aria-label="Telepon Langsung Admin Jasa Angkut Slamet"
                >
                  <IconPhone size={15} />
                  <span>{BUSINESS.phoneDisplay}</span>
                </a>
              </div>
              <div className="footer-social-links" aria-label="Media Sosial">
                <a
                  href={BUSINESS.social.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Kunjungi Instagram Jasa Angkut Slamet"
                >
                  <IconInstagram size={18} />
                </a>
                <a
                  href={BUSINESS.social.tiktok}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Kunjungi TikTok Jasa Angkut Slamet"
                >
                  <IconTikTok size={18} />
                </a>
                <a
                  href={BUSINESS.social.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Kunjungi Facebook Jasa Angkut Slamet"
                >
                  <IconFacebook size={18} />
                </a>
              </div>
            </div>

            <div className="footer-map-col">
              <h3 className="footer-col-title">Peta Garasi</h3>
              <div className="footer-map-card">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3959.59330813383!2d110.49680869999999!3d-7.056979600000001!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e708f76075bb581%3A0xbd15ea2a7eccde93!2sJasa%20Angkut%20Slamet!5e0!3m2!1sid!2sid!4v1793548236364!5m2!1sid!2sid"
                  className="footer-map-iframe"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  title="Peta Lokasi Garasi Jasa Angkut Slamet di Google Maps"
                />
                <a
                  href="https://maps.google.com/?cid=13625126307393437331"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-map-btn"
                  aria-label="Buka petunjuk arah ke Garasi Jasa Angkut Slamet di Google Maps"
                >
                  <IconMapPin size={14} />
                  <span>Petunjuk Arah Maps</span>
                </a>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <span>
              © {new Date().getFullYear()} Jasa Angkut Slamet. Seluruh hak cipta
              dilindungi.
            </span>
            <span>
              <a className="footer-legal-link" href="/privasi.html">
                Kebijakan Privasi &amp; Ketentuan Layanan
              </a>
            </span>
            <span className="footer-disclaimer">
              Perhitungan tarif bersifat transparan. Harga final dikonfirmasi
              via WhatsApp.
            </span>
          </div>
        </div>
      </footer>

      {!mapOpen && !galleryOpen && (
        <div
          className={`fab-dock${showScrollTop ? " is-visible" : ""}`}
          role="group"
          aria-label="Aksi cepat"
        >
          <a
            className="fab fab-wa"
            href={waChatUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chat WhatsApp Jasa Angkut Slamet"
            title="Chat WhatsApp"
          >
            <IconWhatsApp size={22} />
          </a>
          <a
            className="fab fab-order"
            href="#pesan"
            aria-label="Pesan angkut sekarang"
            title="Pesan angkut"
          >
            <IconTruck size={19} />
          </a>
          <button
            type="button"
            className={`scroll-top${showScrollTop ? " is-visible" : ""}`}
            onClick={scrollToTop}
            aria-label="Kembali ke atas halaman"
            title="Kembali ke atas"
            aria-hidden={!showScrollTop}
            tabIndex={showScrollTop ? 0 : -1}
          >
            <IconArrowUp size={20} />
          </button>
        </div>
      )}

      {showMobileBar && (
        <div className="mobile-bar">
          <div className="mobile-bar-total">
            <span className="mobile-bar-label">
              {quote ? "Total estimasi" : "Tarif dasar"}
            </span>
            {quote ? (
              <strong className="mobile-bar-value">
                Rp {quote.total.toLocaleString("id-ID")}
              </strong>
            ) : (
              <>
                <strong className="mobile-bar-value">
                  Rp 7.000<small>/km</small>
                </strong>
                <span className="mobile-bar-note">+ jasa sopir Rp 50.000</span>
              </>
            )}
          </div>
          <div className="mobile-bar-actions">
            <a
              className="btn btn-secondary mobile-bar-wa"
              href={waChatUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Chat WhatsApp Jasa Angkut Slamet"
            >
              <IconWhatsApp size={18} />
            </a>
            {quote && waUrl ? (
              <a
                className="btn btn-primary mobile-bar-cta"
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Pesan
                <IconArrowRight size={16} />
              </a>
            ) : (
              <a className="btn btn-primary mobile-bar-cta" href="#pesan">
                Hitung tarif
                <IconArrowRight size={16} />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
