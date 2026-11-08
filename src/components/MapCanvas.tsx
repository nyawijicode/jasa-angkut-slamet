import { useEffect, useRef, useState } from "react";
import {
  AttributionControl,
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
  type ExpressionSpecification,
  type GeoJSONSource,
} from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type { FeatureCollection, LineString } from "geojson";
import "maplibre-gl/dist/maplibre-gl.css";
import { BUSINESS } from "../config/business";

setWorkerUrl(workerUrl);

type StopKind = "load" | "unload";

type LatLng = { lat: number; lng: number };

export type MapStop = {
  id: string;
  kind: StopKind;
  lat: number | null;
  lng: number | null;
};

type MapCanvasProps = {
  stops: MapStop[];
  activeId: string;
  draft: LatLng | null;
  routeLine: Array<[number, number]>;
  garageToFirstLine: Array<[number, number]>;
  lastToGarageLine: Array<[number, number]>;
  fitPositions: Array<[number, number]>;
  fitSignal: number;
  onPick?: (lat: number, lng: number) => void;
  onDraftMove?: (lat: number, lng: number) => void;
  readOnly?: boolean;
};

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const LOAD_COLOR = "#1F4D3A";
const UNLOAD_COLOR = "#E07A2E";
const ROUTE_COLOR = "#1F4D3A";
const SPUR_COLOR = "#6B7178";
const ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> © ' +
  '<a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a> · ' +
  'Data <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

const EMPTY_LINE: FeatureCollection<LineString> = {
  type: "FeatureCollection",
  features: [],
};

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function linesData(
  lines: Array<Array<[number, number]>>,
): FeatureCollection<LineString> {
  const features = lines
    .filter((points) => points.length >= 2)
    .map((points) => ({
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: points.map(([lat, lng]) => [lng, lat]),
      },
    }));

  if (features.length === 0) return EMPTY_LINE;
  return { type: "FeatureCollection", features };
}

function pinElement(
  color: string,
  label: string,
  active: boolean,
): HTMLElement {
  const element = document.createElement("div");
  element.className = "map-pin";
  element.setAttribute("aria-hidden", "true");
  element.innerHTML = `<div style="position:relative;width:36px;height:44px;${
    active ? "transform:scale(1.12);transform-origin:50% 100%;" : ""
  }">
    <svg width="36" height="44" viewBox="0 0 36 44" xmlns="http://www.w3.org/2000/svg">
      ${
        active
          ? `<circle cx="18" cy="14" r="14.5" fill="none" stroke="${color}" stroke-width="2" opacity="0.35"/>`
          : ""
      }
      <path d="M18 0C10.268 0 4 6.268 4 14c0 10.5 14 30 14 30s14-19.5 14-30C32 6.268 25.732 0 18 0z" fill="${color}" stroke="#fff" stroke-width="2"/>
    </svg>
    <div style="position:absolute;top:8px;left:0;width:36px;text-align:center;font-weight:700;color:#fff;font-family:Inter,sans-serif;font-size:14px">${label}</div>
  </div>`;
  return element;
}

function garageElement(): HTMLElement {
  const element = document.createElement("div");
  element.className = "map-garage";
  element.setAttribute("aria-hidden", "true");
  element.innerHTML =
    '<div style="width:14px;height:14px;border-radius:50%;background:#6B7178;border:2px solid #fff;box-shadow:0 1px 4px rgba(16,24,40,.24)"></div>';
  return element;
}

function firstSymbolId(map: MapLibreMap): string | undefined {
  return map
    .getStyle()
    .layers?.find((layer) => layer.type === "symbol")?.id;
}

function addBuildingLayer(map: MapLibreMap) {
  if (map.getLayer("brand-building-3d")) return;
  // Liberty already ships a styled 3D building layer. Only add our fallback
  // when the base style has no extrusion layer of its own.
  if (map.getStyle().layers?.some((layer) => layer.type === "fill-extrusion")) {
    return;
  }
  const sources = map.getStyle().sources;
  const sourceId = Object.entries(sources).find(
    ([, source]) => "type" in source && source.type === "vector",
  )?.[0];
  if (!sourceId) return;

  map.addLayer(
    {
      id: "brand-building-3d",
      type: "fill-extrusion",
      source: sourceId,
      "source-layer": "building",
      minzoom: 14.2,
      paint: {
        "fill-extrusion-color": "#dfe4da",
        "fill-extrusion-height": [
          "interpolate",
          ["linear"],
          ["zoom"],
          14.2,
          0,
          15.2,
          ["coalesce", ["get", "render_height"], 0],
        ],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
        "fill-extrusion-opacity": 0.72,
      },
    },
    firstSymbolId(map),
  );
}

function addRouteLayers(map: MapLibreMap) {
  if (map.getSource("route-line")) return;
  const before = firstSymbolId(map);

  map.addSource("route-line", {
    type: "geojson",
    data: EMPTY_LINE,
    lineMetrics: true,
  });
  map.addSource("route-spur", { type: "geojson", data: EMPTY_LINE });

  map.addLayer(
    {
      id: "route-spur",
      type: "line",
      source: "route-spur",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": SPUR_COLOR,
        "line-width": 3,
        "line-opacity": 0.65,
        "line-dasharray": [2, 2],
      },
    },
    before,
  );

  map.addLayer(
    {
      id: "route-casing",
      type: "line",
      source: "route-line",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-width": 8,
        "line-opacity": 0.9,
        "line-gradient": solidGradient("#FFFFFF"),
      },
    },
    before,
  );

  map.addLayer(
    {
      id: "route-line",
      type: "line",
      source: "route-line",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-width": 4,
        "line-gradient": solidGradient(ROUTE_COLOR),
      },
    },
    before,
  );
}

function solidGradient(color: string): ExpressionSpecification {
  return ["interpolate", ["linear"], ["line-progress"], 0, color, 1, color];
}

function progressGradient(
  color: string,
  progress: number,
): ExpressionSpecification {
  const stop = Math.min(1, Math.max(0.0001, progress));
  return [
    "interpolate",
    ["linear"],
    ["line-progress"],
    0,
    color,
    stop,
    color,
    Math.min(1, stop + 0.0001),
    "rgba(255,255,255,0)",
  ];
}

export default function MapCanvas({
  stops,
  activeId,
  draft,
  routeLine,
  garageToFirstLine,
  lastToGarageLine,
  fitPositions,
  fitSignal,
  onPick,
  onDraftMove,
  readOnly = false,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const callbacksRef = useRef({ onPick, onDraftMove });
  const readOnlyRef = useRef(readOnly);
  const fitPositionsRef = useRef(fitPositions);
  const skipFlyRef = useRef<string | null>(null);
  const lastDraftRef = useRef<string | null>(null);
  const is3dRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [is3d, setIs3d] = useState(false);

  callbacksRef.current = { onPick, onDraftMove };
  readOnlyRef.current = readOnly;
  fitPositionsRef.current = fitPositions;
  is3dRef.current = is3d;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container,
        style: STYLE_URL,
        center: [BUSINESS.garage.lng, BUSINESS.garage.lat],
        zoom: 12,
        maxPitch: 55,
        attributionControl: false,
        scrollZoom: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      });
    } catch (error) {
      console.error("MapLibre failed to initialize", error);
      setFailed(true);
      return;
    }
    mapRef.current = map;
    setFailed(false);

    map.addControl(
      new NavigationControl({ showCompass: false }),
      "bottom-left",
    );
    map.addControl(
      new AttributionControl({ compact: true, customAttribution: ATTRIBUTION }),
      "bottom-right",
    );
    map.touchZoomRotate.disableRotation();

    const canvas = map.getCanvas();
    const onContextLost = (event: Event) => {
      event.preventDefault();
      setReady(false);
      setFailed(true);
    };
    canvas.addEventListener("webglcontextlost", onContextLost);

    const applyPitch = () => {
      const target = is3dRef.current ? 50 : 0;
      if (Math.abs(map.getPitch() - target) < 1) return;
      if (reducedMotion()) {
        map.setPitch(target);
        return;
      }
      map.easeTo({ pitch: target, duration: 450 });
    };

    const onLoad = () => {
      window.clearTimeout(failTimer);
      setFailed(false);
      addBuildingLayer(map);
      addRouteLayers(map);
      setReady(true);
      applyPitch();
    };

    const failTimer = window.setTimeout(() => {
      if (!map.isStyleLoaded()) setFailed(true);
    }, 10000);

    map.on("load", onLoad);
    map.on("click", (event) => {
      if (readOnlyRef.current) return;
      callbacksRef.current.onPick?.(event.lngLat.lat, event.lngLat.lng);
    });

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(container);

    return () => {
      window.clearTimeout(failTimer);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [attempt]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const duration = reducedMotion() ? 0 : 500;
    const pitch = is3d ? 50 : 0;
    const options: { pitch: number; duration: number; zoom?: number } = {
      pitch,
      duration,
    };
    // Flat by default so every label stays readable; entering 3D raises the
    // camera just enough for the building extrusions to become visible.
    if (is3d && map.getZoom() < 14.2) options.zoom = 15.5;
    map.easeTo(options);
  }, [is3d, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (fitSignal <= 0) return;
    const positions = fitPositionsRef.current;
    if (positions.length === 0) return;
    if (draft) return;

    const duration = reducedMotion() ? 0 : 700;
    if (positions.length === 1) {
      const [lat, lng] = positions[0];
      map.flyTo({
        center: [lng, lat],
        zoom: Math.max(map.getZoom(), 13),
        duration,
      });
      return;
    }

    const bounds = new LngLatBounds();
    positions.forEach(([lat, lng]) => bounds.extend([lng, lat]));
    map.fitBounds(bounds, { padding: 40, maxZoom: 16, duration });
  }, [fitSignal, ready, draft]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !draft) return;

    const key = `${draft.lat},${draft.lng}`;
    if (skipFlyRef.current === key) {
      skipFlyRef.current = null;
      lastDraftRef.current = key;
      return;
    }
    if (lastDraftRef.current === key) return;
    lastDraftRef.current = key;

    map.flyTo({
      center: [draft.lng, draft.lat],
      zoom: Math.max(map.getZoom(), 18),
      pitch: is3dRef.current ? 50 : 0,
      duration: reducedMotion() ? 0 : 650,
      essential: true,
    });
  }, [draft, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const source = map.getSource("route-line") as GeoJSONSource | undefined;
    const spur = map.getSource("route-spur") as GeoJSONSource | undefined;
    source?.setData(linesData([routeLine]));
    spur?.setData(linesData([garageToFirstLine, lastToGarageLine]));

    if (routeLine.length < 2) return;
    if (reducedMotion()) {
      map.setPaintProperty(
        "route-casing",
        "line-gradient",
        solidGradient("#FFFFFF"),
      );
      map.setPaintProperty(
        "route-line",
        "line-gradient",
        solidGradient(ROUTE_COLOR),
      );
      return;
    }

    const duration = 650;
    const start = performance.now();
    let frame = 0;

    const paint = (progress: number) => {
      map.setPaintProperty(
        "route-casing",
        "line-gradient",
        progressGradient("#FFFFFF", progress),
      );
      map.setPaintProperty(
        "route-line",
        "line-gradient",
        progressGradient(ROUTE_COLOR, progress),
      );
    };

    const tick = (now: number) => {
      const raw = Math.min(1, (now - start) / duration);
      paint(1 - Math.pow(1 - raw, 3));
      if (raw < 1) frame = requestAnimationFrame(tick);
    };

    paint(0);
    frame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame);
  }, [routeLine, garageToFirstLine, lastToGarageLine, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const garage = new Marker({
      element: garageElement(),
      anchor: "center",
    })
      .setLngLat([BUSINESS.garage.lng, BUSINESS.garage.lat])
      .addTo(map);
    markersRef.current.push(garage);

    const counts: Record<StopKind, number> = { load: 0, unload: 0 };

    stops.forEach((stop) => {
      if (stop.lat === null || stop.lng === null) return;
      const index = ++counts[stop.kind];
      if (!readOnly && stop.id === activeId) return;
      const color = stop.kind === "load" ? LOAD_COLOR : UNLOAD_COLOR;
      const marker = new Marker({
        element: pinElement(
          color,
          `${stop.kind === "load" ? "M" : "B"}${index}`,
          false,
        ),
        anchor: "bottom",
      })
        .setLngLat([stop.lng, stop.lat])
        .addTo(map);
      markersRef.current.push(marker);
    });

    if (readOnly || !draft) return;
    const active = stops.find((stop) => stop.id === activeId) ?? stops[0];
    const color = active?.kind === "unload" ? UNLOAD_COLOR : LOAD_COLOR;
    const label = active
      ? `${active.kind === "load" ? "M" : "B"}${
          stops
            .filter((stop) => stop.kind === active.kind)
            .findIndex((stop) => stop.id === active.id) + 1
        }`
      : "M1";

    const marker = new Marker({
      element: pinElement(color, label, true),
      anchor: "bottom",
      draggable: !readOnly,
    })
      .setLngLat([draft.lng, draft.lat])
      .addTo(map);

    marker.on("dragend", () => {
      if (readOnlyRef.current) return;
      const position = marker.getLngLat();
      skipFlyRef.current = `${position.lat},${position.lng}`;
      lastDraftRef.current = null;
      callbacksRef.current.onDraftMove?.(position.lat, position.lng);
    });

    markersRef.current.push(marker);
  }, [stops, activeId, draft, readOnly]);

  return (
    <div className="map-libre">
      <div className="map-libre-canvas" ref={containerRef} />
      {!ready && !failed && (
        <div className="map-loading" role="status">
          <span className="spinner" aria-hidden="true" />
          <span>Memuat peta…</span>
        </div>
      )}
      {failed && (
        <div className="map-loading is-error" role="status">
          <span>
            Peta tidak dapat dimuat. Anda masih bisa mencari alamat atau memakai
            lokasi saya.
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setReady(false);
              setFailed(false);
              setAttempt((value) => value + 1);
            }}
          >
            Coba muat ulang
          </button>
        </div>
      )}
      {ready && !failed && (
        <button
          type="button"
          className="map-mode"
          aria-pressed={is3d}
          aria-label="Tampilan 3D"
          title={
            is3d
              ? "Kembali ke tampilan datar"
              : "Tampilkan bangunan dan peta 3D"
          }
          onClick={() => setIs3d((value) => !value)}
        >
          <span aria-hidden="true">3D</span>
        </button>
      )}
    </div>
  );
}
