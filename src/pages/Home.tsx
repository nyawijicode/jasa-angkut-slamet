import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { BUSINESS } from "../config/business";
import { calculateQuote, floorFee } from "../domain/pricing";
import { isValidPhone } from "../domain/phone";
import { formatPickupTime, formatSchedule } from "../domain/schedule";
import { buildWhatsAppUrl, type WaStop } from "../domain/whatsapp";
import type { Helper, Service } from "../domain/types";
import { searchAddress, type GeocodeResult } from "../services/geocoding";
import { fetchRoute, type RouteResult } from "../services/routing";

type StopKind = "load" | "unload";

type Stop = {
  id: string;
  kind: StopKind;
  lat: number | null;
  lng: number | null;
  address: string;
};

type LatLng = { lat: number; lng: number };

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

function makeIcon(color: string, label: string, active = false) {
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:36px;height:44px;${active ? "transform:scale(1.12);transform-origin:50% 100%;" : ""}">
      <svg width="36" height="44" viewBox="0 0 36 44" xmlns="http://www.w3.org/2000/svg">
        ${active ? `<circle cx="18" cy="14" r="14.5" fill="none" stroke="${color}" stroke-width="2" opacity="0.35"/>` : ""}
        <path d="M18 0C10.268 0 4 6.268 4 14c0 10.5 14 30 14 30s14-19.5 14-30C32 6.268 25.732 0 18 0z" fill="${color}" stroke="#fff" stroke-width="2"/>
      </svg>
      <div style="position:absolute;top:8px;left:0;width:36px;text-align:center;font-weight:700;color:#fff;font-family:Inter,sans-serif;font-size:14px">${label}</div>
    </div>`,
    iconSize: [36, 44],
    iconAnchor: [18, 44],
  });
}

const iconGarage = L.divIcon({
  className: "",
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#6B7178;border:2px solid #fff;box-shadow:0 1px 4px rgba(16,24,40,.24)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function ClickHandler({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FitRoute({
  positions,
  signal,
}: {
  positions: Array<[number, number]>;
  signal: number;
}) {
  const map = useMap();
  const positionsRef = useRef(positions);
  positionsRef.current = positions;

  useEffect(() => {
    if (signal <= 0 || positionsRef.current.length < 2) return;
    map.fitBounds(L.latLngBounds(positionsRef.current), {
      padding: [36, 36],
      maxZoom: 16,
    });
  }, [signal, map]);
  return null;
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
  const map = useMap();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const found = await searchAddress(q, controller.signal);
        setResults(found);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  function pick(result: GeocodeResult) {
    onSelect(result.lat, result.lon, result.display_name);
    map.flyTo([result.lat, result.lon], 16, { duration: 0.6 });
    setQuery(result.display_name);
    setResults([]);
  }

  return (
    <div className="map-search">
      <div className="map-search-field">
        <IconSearch size={18} className="map-search-icon" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && results[0]) {
              event.preventDefault();
              pick(results[0]);
            }
            if (event.key === "Escape") setResults([]);
          }}
          placeholder={`Cari alamat titik ${activeLabel} (${STOP_KIND_LABEL[active]})...`}
          aria-label={`Cari alamat titik ${activeLabel} (${STOP_KIND_LABEL[active]})`}
          aria-expanded={results.length > 0}
        />
        {loading && (
          <span className="spinner" role="status" aria-label="Mencari alamat" />
        )}
      </div>
      {results.length > 0 && (
        <div
          className="map-search-results"
          role="listbox"
          aria-label="Hasil pencarian alamat"
        >
          {results.map((result, index) => (
            <button
              key={`${result.lat}-${result.lon}-${index}`}
              type="button"
              className="map-result"
              role="option"
              aria-selected={false}
              onClick={() => pick(result)}
            >
              <strong>{result.display_name.split(",")[0]}</strong>
              <span>{result.display_name}</span>
            </button>
          ))}
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

export default function Home() {
  const nextStopId = useRef(3);
  const [stops, setStops] = useState<Stop[]>(() => [
    { id: "stop-1", kind: "load", lat: null, lng: null, address: "" },
    { id: "stop-2", kind: "unload", lat: null, lng: null, address: "" },
  ]);
  const [activeId, setActiveId] = useState("stop-1");
  const [floors, setFloors] = useState<Record<string, number>>({});
  const [fitTick, setFitTick] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [service, setService] = useState<Service>("dalam-kota");
  const [helper, setHelper] = useState<Helper>("none");
  const [note, setNote] = useState("");

  const [step, setStep] = useState(1);
  const [furthest, setFurthest] = useState(1);

  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [routeStatus, setRouteStatus] = useState<RouteStatus>("idle");

  const panelRef = useRef<HTMLElement | null>(null);

  const today = useMemo(todayISO, []);
  const nameError = false;
  const phoneError = phone.trim().length > 0 && !isValidPhone(phone);
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
  const routeKey = routePoints.map((point) => `${point.lat},${point.lng}`).join("|");

  const loadIconKey = loadStops.map((stop) => stop.id).join(",");
  const unloadIconKey = unloadStops.map((stop) => stop.id).join(",");
  const stopIcons = useMemo(() => {
    const icons: Record<string, L.DivIcon> = {};
    loadStops.forEach((stop, index) => {
      icons[stop.id] = makeIcon(
        "#1F4D3A",
        `M${index + 1}`,
        stop.id === activeId,
      );
    });
    unloadStops.forEach((stop, index) => {
      icons[stop.id] = makeIcon(
        "#E07A2E",
        `B${index + 1}`,
        stop.id === activeId,
      );
    });
    return icons;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadIconKey, unloadIconKey, activeId]);

  useEffect(() => {
    if (!allStopsSet || routePoints.length < 2) {
      setPlan(null);
      setRouteStatus("idle");
      return;
    }

    const controller = new AbortController();
    const roundTrip = service === "luar-kota";
    setPlan(null);
    setRouteStatus("loading");

    const mainPairs = routePoints
      .slice(0, -1)
      .map((point, index) => [point, routePoints[index + 1]] as const);
    const first = routePoints[0];
    const last = routePoints[routePoints.length - 1];

    Promise.all([
      ...mainPairs.map(([from, to]) =>
        fetchRoute(from, to, controller.signal),
      ),
      roundTrip ? fetchRoute(BUSINESS.garage, first, controller.signal) : null,
      roundTrip ? fetchRoute(last, BUSINESS.garage, controller.signal) : null,
    ]).then((results) => {
      if (controller.signal.aborted) return;
      const main = results.slice(0, mainPairs.length) as Array<RouteResult | null>;
      const garageToFirst = results[mainPairs.length] ?? null;
      const lastToGarage = results[mainPairs.length + 1] ?? null;
      const mainOk = main.length > 0 && main.every(Boolean);
      const garageOk = !roundTrip || (Boolean(garageToFirst) && Boolean(lastToGarage));
      setPlan({
        main: main.filter((leg): leg is RouteResult => Boolean(leg)),
        garageToFirst,
        lastToGarage,
      });
      setRouteStatus(mainOk && garageOk ? "ready" : "error");
    });

    return () => controller.abort();
  }, [routeKey, service, allStopsSet]);

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
        loadStops.length > 0 &&
        loadStops.every((stop) => stop.lat !== null),
    },
    {
      label: "Titik bongkar",
      done:
        unloadStops.length > 0 &&
        unloadStops.every((stop) => stop.lat !== null),
    },
    { label: "Nama", done: true },
    { label: "Nomor HP", done: true },
    { label: "Layanan", done: true },
  ];
  const missing = steps.filter((step) => !step.done).map((step) => step.label);

  const wizardSteps = [
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
    if (service === "luar-kota") {
      return {
        garageToLoad: straightLineKm(BUSINESS.garage, routePoints[0]),
        loadToUnload: mainKm,
        unloadToGarage: straightLineKm(
          routePoints[routePoints.length - 1],
          BUSINESS.garage,
        ),
      };
    }
    return { loadToUnload: mainKm };
  }, [allStopsSet, routePoints, service]);

  const routeDistances = useMemo(() => {
    if (routeStatus !== "ready" || !plan) return straightDistances;
    const mainKm = plan.main.reduce((total, leg) => total + leg.distanceKm, 0);
    if (service === "luar-kota") {
      return {
        garageToLoad: plan.garageToFirst?.distanceKm ?? 0,
        loadToUnload: mainKm,
        unloadToGarage: plan.lastToGarage?.distanceKm ?? 0,
      };
    }
    return { loadToUnload: mainKm };
  }, [plan, routeStatus, service, straightDistances]);

  const quote = useMemo(() => {
    if (!allStopsSet || !routeDistances) return null;
    if (phone.trim() !== "" && !isValidPhone(phone)) return null;

    const loadFloorList = loadStops.map((stop) => floors[stop.id] ?? 1);
    const unloadFloorList = unloadStops.map((stop) => floors[stop.id] ?? 1);

    try {
      return calculateQuote({
        service,
        distances: routeDistances,
        helper,
        loadFloor: loadFloorList[0] ?? 1,
        unloadFloor: unloadFloorList[0] ?? 1,
        loadFloors: loadFloorList,
        unloadFloors: unloadFloorList,
      });
    } catch {
      return null;
    }
  }, [
    allStopsSet,
    routeDistances,
    phone,
    service,
    helper,
    floors,
    loadStops,
    unloadStops,
  ]);

  const waUrl = useMemo(() => {
    if (!quote || !allStopsSet) return null;

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
      name: name.trim(),
      phone: phone.trim(),
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
      distanceKm: quote.billableKm,
      note,
      quote,
    });
  }, [
    quote,
    allStopsSet,
    loadStops,
    unloadStops,
    name,
    phone,
    pickupDate,
    pickupTime,
    service,
    helper,
    floors,
    note,
  ]);

  const mainRouteLine = useMemo<Array<[number, number]>>(() => {
    if (routeStatus !== "ready" || !plan) return [];
    return plan.main.flatMap((leg) => leg.coordinates);
  }, [plan, routeStatus]);

  const fallbackLine = useMemo<Array<[number, number]>>(() => {
    if (!allStopsSet || routePoints.length < 2) return [];
    const points = routePoints.map(
      (point) => [point.lat, point.lng] as [number, number],
    );
    if (service === "luar-kota") {
      return [
        [BUSINESS.garage.lat, BUSINESS.garage.lng],
        ...points,
        [BUSINESS.garage.lat, BUSINESS.garage.lng],
      ];
    }
    return points;
  }, [allStopsSet, routePoints, service]);

  const routeLine = useMemo<Array<[number, number]>>(() => {
    if (routeStatus === "ready") return mainRouteLine;
    if (routeStatus === "error") return fallbackLine;
    return [];
  }, [routeStatus, mainRouteLine, fallbackLine]);

  const garageToFirstLine = useMemo<Array<[number, number]>>(
    () =>
      routeStatus === "ready" && service === "luar-kota"
        ? (plan?.garageToFirst?.coordinates ?? [])
        : [],
    [routeStatus, service, plan],
  );

  const lastToGarageLine = useMemo<Array<[number, number]>>(
    () =>
      routeStatus === "ready" && service === "luar-kota"
        ? (plan?.lastToGarage?.coordinates ?? [])
        : [],
    [routeStatus, service, plan],
  );

  const fitPositions = useMemo<Array<[number, number]>>(
    () => [...garageToFirstLine, ...routeLine, ...lastToGarageLine],
    [garageToFirstLine, routeLine, lastToGarageLine],
  );

  const routeSummary = useMemo(() => {
    if (routeStatus !== "ready" || !plan) return null;
    const legs = [
      ...(plan.garageToFirst ? [plan.garageToFirst] : []),
      ...plan.main,
      ...(plan.lastToGarage ? [plan.lastToGarage] : []),
    ];
    return {
      km: legs.reduce((total, leg) => total + leg.distanceKm, 0),
      minutes: legs.reduce((total, leg) => total + leg.durationMin, 0),
    };
  }, [plan, routeStatus]);

  // Auto-advance only for the default M1/B1 flow, and only forward. With extra
  // stops the active point stays put so repeated map clicks land on the same
  // point instead of cycling between stops.
  function autoNextAfter(id: string): Stop | undefined {
    if (stops.length > 2) return undefined;
    const index = orderedStops.findIndex((stop) => stop.id === id);
    return orderedStops.slice(index + 1).find((stop) => stop.lat === null);
  }

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
      return [...prev.slice(0, lastLoad + 1), stop, ...prev.slice(lastLoad + 1)];
    });
    setActiveId(stop.id);
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
    if (!activeStop) return;
    const address = `Titik di peta (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
    const next = autoNextAfter(activeStop.id);
    updateStopPoint(activeStop.id, lat, lng, address);
    if (next) setActiveId(next.id);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      alert(
        "Peramban ini belum mendukung deteksi lokasi. silahkan cari alamat atau ketuk peta.",
      );
      return;
    }
    const stop = activeStop;
    if (!stop) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const address = `Lokasi saat ini (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`;
        const next = autoNextAfter(stop.id);
        updateStopPoint(stop.id, latitude, longitude, address);
        if (next) setActiveId(next.id);
      },
      () => {
        alert(
          "Izin lokasi ditolak. Anda masih bisa mencari alamat atau mengetuk peta.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }

  function selectPoint(lat: number, lng: number, address: string) {
    if (!activeStop) return;
    const next = autoNextAfter(activeStop.id);
    updateStopPoint(activeStop.id, lat, lng, address);
    if (next) setActiveId(next.id);
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

  function scrollToPanel() {
    const isSmallScreen =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 1023px)").matches;
    if (!isSmallScreen) return;
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function validateStep1() {
    if (phone.trim() === "" || isValidPhone(phone)) {
      return true;
    }

    window.setTimeout(() => {
      document.getElementById("customer-phone")?.focus();
    }, 0);

    return false;
  }

  function advance() {
    if (step === 1 && !validateStep1()) return;
    const next = Math.min(wizardSteps.length, step + 1);
    setStep(next);
    setFurthest((current) => Math.max(current, next));
    scrollToPanel();
  }

  function goBack() {
    setStep((current) => Math.max(1, current - 1));
    scrollToPanel();
  }

  function goToStep(target: number) {
    if (target > furthest) return;
    if (target > 1 && !validateStep1()) {
      setStep(1);
      return;
    }
    setStep(target);
    scrollToPanel();
  }

  function showRoute(mode: StopKind) {
    const target =
      stops.find((stop) => stop.kind === mode && stop.lat === null) ??
      stops.find((stop) => stop.kind === mode);
    if (target) setActiveId(target.id);
    document
      .getElementById("peta")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div
      className={
        step === 5 && quote ? "site-shell has-mobile-bar" : "site-shell"
      }
    >
      <header className="site-header">
        <div className="container header-inner">
          <a
            className="brand"
            href="/"
            aria-label="Jasa Angkut Slamet — beranda"
          >
            <span className="brand-mark">
              <IconTruck size={23} />
            </span>
            <span>
              <span className="brand-name">Jasa Angkut Slamet</span>
              <span className="brand-meta">Demak · Semarang · Kebonbatur</span>
            </span>
          </a>
          <div className="header-actions">
            <a className="header-phone" href={`tel:+${BUSINESS.whatsapp}`}>
              <IconPhone size={16} />
              {BUSINESS.phoneDisplay}
            </a>
            <a
              className="btn btn-primary"
              href={waChatUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Chat WhatsApp"
            >
              <IconWhatsApp size={18} />
              <span>Chat WhatsApp</span>
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="container hero">
          <div className="hero-grid">
            <div className="hero-content">
              <span className="eyebrow">
                <span className="eyebrow-dot" />
                Melayani Mranggen, Demak &amp; Semarang
              </span>
              <h1 className="hero-title">
                Hitung ongkos angkut,
                <br />
                <span>langsung kirim ke WhatsApp.</span>
              </h1>
              <p className="hero-lead">
                Tandai satu atau beberapa titik muat dan bongkar di peta.
                Estimasi harga muncul otomatis, lengkap dengan rincian yang
                bisa langsung dikirim ke Jasa Angkut Slamet.
              </p>
              <ul className="hero-points">
                <li className="hero-point">
                  <IconCheck size={16} />
                  Tanpa aplikasi
                </li>
                <li className="hero-point">
                  <IconCheck size={16} />
                  Harga transparan
                </li>
                <li className="hero-point">
                  <IconCheck size={16} />
                  Dibalas langsung
                </li>
              </ul>
            </div>

            <aside className="area-card" aria-label="Area layanan">
              <div className="area-card-head">
                <IconMapPin size={16} />
                Area layanan
              </div>
              <div className="area-chips">
                {[
                  "Kab Semarang",
                  "Semarang",
                  "Kebonbatur",
                  "Mranggen",
                  "Demak",
                ].map((area) => (
                  <span className="chip" key={area}>
                    {area}
                  </span>
                ))}
              </div>
              <div className="area-card-foot">
                Garasi kami di Kebonbatur, Mranggen, Demak. Butuh jadwal khusus?{" "}
                <a href={waChatUrl} target="_blank" rel="noopener noreferrer">
                  Tanya via WhatsApp
                </a>
                .
              </div>
            </aside>
          </div>
        </section>

        <section className="container workspace" id="pesan">
          <div className="map-card" id="peta">
            <div className="map-card-head">
              <div className="map-card-title">
                <h2>Rute angkutan</h2>
                <p>
                  Klik peta atau cari alamat untuk menandai{" "}
                  <strong>
                    {activeStop ? stopLabel(activeStop, stops) : "titik"}
                  </strong>
                  . Pilih kartu titik di bawah untuk menandai titik lain.
                </p>
              </div>
              <div
                className={`map-target${activeStop?.kind === "unload" ? " is-unload" : ""}`}
                aria-live="polite"
              >
                <span
                  className={`segment-dot ${activeStop?.kind ?? "load"}`}
                  aria-hidden="true"
                />
                Menandai {activeStop ? stopLabel(activeStop, stops) : "—"}
              </div>
            </div>

            <div className="map-canvas">
              <MapContainer
                center={[BUSINESS.garage.lat, BUSINESS.garage.lng]}
                zoom={12}
                scrollWheelZoom={false}
                zoomControl={false}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <ZoomControl position="bottomleft" />
                <ClickHandler onPick={pick} />
                <Marker
                  position={[BUSINESS.garage.lat, BUSINESS.garage.lng]}
                  icon={iconGarage}
                />
                {stops.map((stop) =>
                  stop.lat !== null && stop.lng !== null ? (
                    <Marker
                      key={stop.id}
                      position={[stop.lat, stop.lng]}
                      icon={
                        stopIcons[stop.id] ??
                        makeIcon(
                          stop.kind === "load" ? "#1F4D3A" : "#E07A2E",
                          stop.kind === "load" ? "M" : "B",
                          stop.id === activeId,
                        )
                      }
                      draggable
                      eventHandlers={{
                        click: () => setActiveId(stop.id),
                        dragend: (event) => {
                          const marker = event.target.getLatLng();
                          updateStopPoint(
                            stop.id,
                            marker.lat,
                            marker.lng,
                            `Titik di peta (${marker.lat.toFixed(5)}, ${marker.lng.toFixed(5)})`,
                          );
                        },
                      }}
                    />
                  ) : null,
                )}
                {garageToFirstLine.length > 1 && (
                  <Polyline
                    positions={garageToFirstLine}
                    color="#6B7178"
                    weight={3}
                    opacity={0.65}
                    dashArray="6 7"
                  />
                )}
                {lastToGarageLine.length > 1 && (
                  <Polyline
                    positions={lastToGarageLine}
                    color="#6B7178"
                    weight={3}
                    opacity={0.65}
                    dashArray="6 7"
                  />
                )}
                {routeLine.length > 1 && (
                  <>
                    <Polyline
                      positions={routeLine}
                      color="#FFFFFF"
                      weight={8}
                      opacity={0.9}
                    />
                    <Polyline
                      positions={routeLine}
                      color="#1F4D3A"
                      weight={4}
                    />
                  </>
                )}
                <FitRoute positions={fitPositions} signal={fitTick} />
                <MapSearchControl
                  active={activeStop?.kind ?? "load"}
                  activeLabel={activeStop ? stopLabel(activeStop, stops) : "M1"}
                  onSelect={selectPoint}
                />
              </MapContainer>
              <button
                type="button"
                className="map-locate"
                onClick={useMyLocation}
              >
                <IconTarget size={17} />
                <span>Lokasi saya</span>
              </button>
            </div>

            <div className="route-summary">
              <div className="route-tools">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setFitTick((tick) => tick + 1)}
                  disabled={fitPositions.length < 2}
                >
                  <IconRoute size={14} />
                  Lihat rute di peta
                </button>
              </div>
              <div className="route-groups">
                {(
                  [
                    { kind: "load", items: loadStops },
                    { kind: "unload", items: unloadStops },
                  ] as Array<{ kind: StopKind; items: Stop[] }>
                ).map(({ kind, items }) => (
                  <div className={`route-group is-${kind}`} key={kind}>
                    <div className="route-group-head">
                      <span className="route-group-title">
                        <span className={`segment-dot ${kind}`} aria-hidden="true" />
                        Titik {STOP_KIND_LABEL[kind]}
                      </span>
                      <button
                        type="button"
                        className="route-add"
                        onClick={() => addStop(kind)}
                      >
                        + Tambah
                      </button>
                    </div>
                    <div className="route-list">
                      {items.map((stop, index) => {
                        const selected = activeId === stop.id;
                        const hasPoint = stop.lat !== null && stop.lng !== null;
                        const floor = floorOf(stop.id);
                        const fee = floorFee(floor);
                        const label = `${kind === "load" ? "M" : "B"}${index + 1}`;
                        return (
                          <div
                            key={stop.id}
                            className={`route-point${kind === "unload" ? " is-unload" : ""}${selected ? " is-active" : ""}`}
                            onClick={() => setActiveId(stop.id)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setActiveId(stop.id);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            aria-pressed={selected}
                            title={`Klik untuk memilih titik ${label} di peta`}
                          >
                            <span
                              className={`route-dot ${kind}`}
                              aria-hidden="true"
                            />
                            <div className="route-point-main">
                              <span className="route-label">
                                {label} · Titik {STOP_KIND_LABEL[kind]}
                              </span>
                              <p
                                className={`route-address${hasPoint ? "" : " is-empty"}`}
                              >
                                {hasPoint
                                  ? stop.address
                                  : selected
                                    ? "Belum dipilih (klik peta untuk menandai)"
                                    : "Belum dipilih"}
                              </p>
                              <span className="route-floor">
                                Lantai {floor} ·{" "}
                                {fee === 0
                                  ? "Gratis"
                                  : `+Rp${fee.toLocaleString("id-ID")}`}
                              </span>
                            </div>
                            {selected && (
                              <span className="route-active-badge">Menandai</span>
                            )}
                            {(hasPoint || items.length > 1) && (
                              <button
                                type="button"
                                className="route-clear"
                                aria-label={`Hapus titik ${label}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  removeStop(stop.id);
                                }}
                              >
                                Hapus
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <p className="route-footnote">
                Catatan: jika alamat kurang sesuai, lengkapi/ubah patokan
                detailnya saat mengirim pesanan di WhatsApp.
              </p>
              {allStopsSet && (
                <div
                  className={`route-meta${routeStatus === "error" ? " is-warn" : ""}`}
                  aria-live="polite"
                >
                  {routeStatus === "loading" && (
                    <>
                      <span className="spinner" aria-hidden="true" />
                      <span>Menghitung rute mobil...</span>
                    </>
                  )}
                  {routeStatus === "ready" && routeSummary && (
                    <>
                      <IconRoute size={14} />
                      <span>
                        Rute mobil {routeSummary.km.toFixed(1)} km · ±
                        {Math.max(1, Math.round(routeSummary.minutes))} menit
                        {service === "luar-kota"
                          ? " · termasuk garasi"
                          : ` · ${stops.length} titik`}
                      </span>
                    </>
                  )}
                  {routeStatus === "error" && (
                    <>
                      <IconAlert size={14} />
                      <span>
                        Rute mobil tidak tersedia. Jarak sementara dihitung
                        garis lurus.
                      </span>
                    </>
                  )}
                </div>
              )}
              {!allStopsSet && stops.some((stop) => stop.lat !== null) && (
                <div className="route-meta is-warn">
                  <IconAlert size={14} />
                  <span>Lengkapi semua titik untuk menghitung rute.</span>
                </div>
              )}
            </div>
          </div>

          <section
            className="panel"
            aria-labelledby="form-title"
            ref={panelRef}
          >
            <div className="panel-head">
              <div>
                <span className="panel-eyebrow">Pesan angkutan</span>
                <h2 className="panel-title" id="form-title">
                  Isi detail angkutan
                </h2>
                <p className="panel-sub">
                  Ikuti langkah singkat, estimasi muncul di akhir.
                </p>
              </div>
              <div className="progress">
                <div className="progress-label">
                  <span>
                    Langkah {step} dari {wizardSteps.length}
                  </span>
                  <span>{Math.round((step / wizardSteps.length) * 100)}%</span>
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
                    style={{ width: `${(step / wizardSteps.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="panel-body">
              <nav className="wizard-nav" aria-label="Langkah pemesanan">
                {wizardSteps.map((label, index) => {
                  const value = index + 1;
                  const isActive = value === step;
                  const isDone = value < step;
                  const isReachable = value <= furthest;
                  return (
                    <button
                      key={label}
                      type="button"
                      className={`wizard-step${isActive ? " is-active" : ""}${isDone ? " is-done" : ""}`}
                      onClick={() => goToStep(value)}
                      disabled={!isReachable}
                      aria-current={isActive ? "step" : undefined}
                    >
                      <span className="wizard-step-marker">
                        {isDone ? <IconCheck size={13} /> : value}
                      </span>
                      <span className="wizard-step-label">{label}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="wizard-body">
                {step === 1 && (
                  <section className="form-section">
                    <div className="section-head">
                      <span className="step-badge">1</span>
                      <div className="section-copy">
                        <h3>Data pemesan</h3>
                        <p>Nama dan nomor yang bisa kami hubungi.</p>
                      </div>
                    </div>

                    <div className="field-stack">
                      <div className="field">
                        <label className="field-label" htmlFor="customer-name">
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
                            onChange={(event) => setName(event.target.value)}
                            placeholder="Contoh: Budi Santoso"
                            autoComplete="name"
                            enterKeyHint="next"
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
                          <p className="field-error" id="name-error">
                            <IconAlert size={15} />
                            Nama belum diisi.
                          </p>
                        )}
                      </div>

                      <div className="field">
                        <label className="field-label" htmlFor="customer-phone">
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
                            value={phone}
                            onChange={(event) => setPhone(event.target.value)}
                            placeholder="0813 2762 3942"
                            inputMode="tel"
                            autoComplete="tel"
                            enterKeyHint="next"
                            aria-invalid={phoneError}
                            aria-describedby={
                              phoneError ? "phone-error" : "phone-hint"
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
                          <p className="field-error" id="phone-error">
                            <IconAlert size={15} />
                            {phone.trim().length > 0
                              ? "Nomor HP belum benar. Contoh: 0813 2762 3942"
                              : "Nomor HP wajib diisi. Contoh: 0813 2762 3942"}
                          </p>
                        ) : (
                          <p className="field-hint" id="phone-hint">
                            Kami hanya menghubungi nomor ini untuk pesanan Anda.
                          </p>
                        )}
                      </div>

                      <div className="field schedule-field">
                        <div className="field-label-row">
                          <span className="field-label">Jadwal angkut</span>
                          <span className="badge-optional">Opsional</span>
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
                                  <optgroup key={grp.group} label={grp.group}>
                                    {grp.options.map((opt) => (
                                      <option key={opt.value} value={opt.value}>
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
                              onClick={() => setPickupTime(preset.time)}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>

                        {pickupTime && (
                          <div className="time-selected-alert">
                            <IconClock size={14} />
                            <span>
                              Jam jemput: {formatPickupTime(pickupTime)}
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
                          Kosongkan jika jadwal akan dibicarakan lewat WhatsApp.
                        </p>
                      </div>
                    </div>

                    <div className="wizard-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-lg wizard-actions-right"
                        onClick={advance}
                      >
                        <span>Lanjut ke Layanan</span>
                        <IconArrowRight size={18} />
                      </button>
                    </div>
                  </section>
                )}

                {step === 2 && (
                  <section className="form-section">
                    <div className="section-head">
                      <span className="step-badge">2</span>
                      <div className="section-copy">
                        <h3>Layanan</h3>
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
                          <span className="choice-title">Dalam Kota</span>
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
                          <span className="choice-title">Luar Kota</span>
                        </span>
                        <span className="choice-check">
                          <IconCheck size={12} />
                        </span>
                      </button>
                    </div>

                    <div className="wizard-actions">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={goBack}
                      >
                        <IconArrowLeft size={18} />
                        <span>Kembali</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={advance}
                      >
                        <span>Lanjut ke Bantuan &amp; Lantai</span>
                        <IconArrowRight size={18} />
                      </button>
                    </div>
                  </section>
                )}

                {step === 3 && (
                  <section className="form-section">
                    <div className="section-head">
                      <span className="step-badge">3</span>
                      <div className="section-copy">
                        <h3>Bantuan &amp; lantai</h3>
                        <p>Pilih bantuan dan akses lantai di kedua titik.</p>
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
                              <div className="stepper-value" aria-live="polite">
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
                      Biaya lantai dihitung untuk setiap titik muat dan bongkar.
                    </p>

                    <div className="wizard-actions">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={goBack}
                      >
                        <IconArrowLeft size={18} />
                        <span>Kembali</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={advance}
                      >
                        <span>Lanjut ke Catatan</span>
                        <IconArrowRight size={18} />
                      </button>
                    </div>
                  </section>
                )}

                {step === 4 && (
                  <section className="form-section">
                    <div className="section-head">
                      <span className="step-badge">4</span>
                      <div className="section-copy">
                        <h3>Catatan tambahan</h3>
                        <p>
                          Detail yang membantu tim kami di lapangan (opsional).
                        </p>
                      </div>
                    </div>

                    <div className="field">
                      <div className="field-label-row">
                        <label className="field-label" htmlFor="customer-note">
                          Catatan khusus
                        </label>
                        <span className="badge-optional">Opsional</span>
                      </div>
                      <div className="textarea-shell">
                        <textarea
                          id="customer-note"
                          className="field-textarea"
                          value={note}
                          onChange={(event) => setNote(event.target.value)}
                          maxLength={300}
                          rows={3}
                          placeholder="Contoh: barang perlu ditutup terpal, ada tangga sempit, mohon datang jam 8 pagi."
                        />
                        <span className="char-count">{note.length}/300</span>
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

                    <div className="wizard-actions">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={goBack}
                      >
                        <IconArrowLeft size={18} />
                        <span>Kembali</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={advance}
                      >
                        <span>Lihat Ringkasan Estimasi</span>
                        <IconArrowRight size={18} />
                      </button>
                    </div>
                  </section>
                )}

                {step === 5 && (
                  <section className="form-section">
                    <div className="section-head">
                      <span className="step-badge">5</span>
                      <div className="section-copy">
                        <h3>Ringkasan estimasi</h3>
                        <p>
                          Periksa kembali rincian data dan estimasi ongkos
                          sebelum kirim ke WhatsApp.
                        </p>
                      </div>
                    </div>

                    {!allStopsSet && (
                      <div className="route-warning-banner" role="alert">
                        <IconAlert size={20} />
                        <div>
                          <p>
                            <strong>Titik rute di peta belum lengkap!</strong>
                            <br />
                            {orderedStops
                              .filter((stop) => stop.lat === null)
                              .map((stop) => stopLabel(stop, stops))
                              .join(", ")}{" "}
                            belum ditandai di peta. Tandai semua titik agar
                            jarak &amp; ongkos otomatis dihitung.
                          </p>
                          <button
                            type="button"
                            className="btn-map-jump"
                            onClick={() =>
                              showRoute(
                                orderedStops.find((stop) => stop.lat === null)
                                  ?.kind ?? "load",
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
                            onClick={() => goToStep(1)}
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
                              {scheduleLabel || "Dibicarakan lewat WhatsApp"}
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
                                {stop.kind === "load" ? "Muat" : "Bongkar"}
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
                              <dt>Jarak terhitung</dt>
                              <dd>{quote.billableKm} km</dd>
                            </div>
                          )}
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
                            onClick={() => goToStep(2)}
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
                      style={{ marginTop: 0, paddingTop: 0, borderTop: 0 }}
                    >
                      {quote ? (
                        <div className="quote-card" aria-live="polite">
                          <div className="quote-head">
                            <span className="quote-title">
                              Rincian Estimasi Biaya
                            </span>
                            <span className="quote-badge">Estimasi</span>
                          </div>
                          <dl className="quote-lines">
                            <div className="quote-line">
                              <dt>Jarak</dt>
                              <dd>{quote.billableKm} km</dd>
                            </div>
                            <div className="quote-line">
                              <dt>Ongkos angkut</dt>
                              <dd>
                                Rp {quote.transport.toLocaleString("id-ID")}
                              </dd>
                            </div>
                            {quote.helper > 0 && (
                              <div className="quote-line">
                                <dt>Bantuan bongkar muat</dt>
                                <dd>
                                  Rp {quote.helper.toLocaleString("id-ID")}
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
                                  Rp {quote.loadFloor.toLocaleString("id-ID")}
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
                                  Rp {quote.unloadFloor.toLocaleString("id-ID")}
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
                            Harga final dikonfirmasi oleh Jasa Angkut Slamet
                            lewat WhatsApp.
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
                          {missing.join(", ").toLowerCase() || "data pesanan"}{" "}
                          untuk mengaktifkan tombol.
                        </p>
                      )}
                    </div>

                    <div className="wizard-actions">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={goBack}
                      >
                        <IconArrowLeft size={18} />
                        <span>Kembali ke Catatan</span>
                      </button>
                    </div>
                  </section>
                )}
              </div>
            </div>
          </section>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <div className="brand">
                <span className="brand-mark">
                  <IconTruck size={23} />
                </span>
                <span>
                  <span className="brand-name">Jasa Angkut Slamet</span>
                  <span className="brand-meta">
                    Angkutan barang &amp; pindahan
                  </span>
                </span>
              </div>
              <p>
                Melayani angkutan barang, pindahan rumah, dan kiriman usaha di
                Demak, Semarang, Kebonbatur, Mranggen, dan sekitarnya.
              </p>
            </div>
            <div className="footer-col">
              <h4>Garasi</h4>
              <address>{BUSINESS.garage.address}</address>
            </div>
            <div className="footer-col">
              <h4>Kontak</h4>
              <a href={`tel:+${BUSINESS.whatsapp}`}>
                <IconPhone size={15} />
                {BUSINESS.phoneDisplay}
              </a>
              <a href={waChatUrl} target="_blank" rel="noopener noreferrer">
                <IconWhatsApp size={15} />
                WhatsApp
              </a>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} Jasa Angkut Slamet</span>
            <span>Ini estimasi. Harga final dikonfirmasi lewat WhatsApp.</span>
          </div>
        </div>
      </footer>

      {quote && (
        <div className="mobile-bar">
          <div className="mobile-bar-total">
            <span className="mobile-bar-label">Total estimasi</span>
            <strong className="mobile-bar-value">
              Rp {quote.total.toLocaleString("id-ID")}
            </strong>
          </div>
          {waUrl && (
            <a
              className="btn btn-primary"
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconWhatsApp size={18} />
              Kirim
            </a>
          )}
        </div>
      )}
    </div>
  );
}
