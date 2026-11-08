type EventName =
  | "wizard_started"
  | "estimate_ready"
  | "wizard_completed"
  | "whatsapp_click"
  | "map_opened";

type EventPayload = Record<string, string | number | boolean | undefined>;

type AnalyticsWindow = Window & {
  dataLayer?: Array<Record<string, unknown>>;
};

const endpoint = import.meta.env.VITE_ANALYTICS_ENDPOINT?.trim();

/**
 * Sends anonymous product events. No names, phone numbers, addresses, or
 * coordinates are ever included. Without VITE_ANALYTICS_ENDPOINT the event is
 * only exposed to the page (dataLayer/CustomEvent) so consent-friendly
 * providers can pick it up later.
 */
export function track(event: EventName, payload: EventPayload = {}) {
  if (typeof window === "undefined") return;

  const detail = { event, ...payload };
  window.dispatchEvent(
    new CustomEvent("angkut:analytics", { detail }),
  );

  const analyticsWindow = window as AnalyticsWindow;
  if (Array.isArray(analyticsWindow.dataLayer)) {
    analyticsWindow.dataLayer.push(detail);
  }

  if (!endpoint) return;

  const body = JSON.stringify({
    ...detail,
    path: window.location.pathname,
  });

  if (typeof navigator.sendBeacon === "function") {
    navigator.sendBeacon(
      endpoint,
      new Blob([body], { type: "application/json" }),
    );
    return;
  }

  fetch(endpoint, {
    method: "POST",
    body,
    keepalive: true,
    headers: { "Content-Type": "application/json" },
  }).catch(() => {
    // Analytics failures must never block the ordering flow.
  });
}
