import { expect, type Page } from "playwright/test";

export const MAP_STYLE = {
  version: 8,
  name: "e2e-stub",
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#eef2ec" },
    },
  ],
};

export const PLACES = [
  {
    display_name: "Mranggen, Demak, Jawa Tengah, Indonesia",
    lat: "-7.0264",
    lon: "110.5149",
  },
  {
    display_name: "Kebonbatur, Mranggen, Demak, Jawa Tengah, Indonesia",
    lat: "-7.057",
    lon: "110.497",
  },
];

export const ROUTE = {
  code: "Ok",
  routes: [
    {
      distance: 12400,
      duration: 1500,
      geometry: {
        type: "LineString",
        coordinates: [
          [110.5149, -7.0264],
          [110.5, -7.04],
          [110.4203, -6.9932],
        ],
      },
    },
  ],
};

export async function installMapStubs(page: Page) {
  await page.route("**/tiles.openfreemap.org/**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(MAP_STYLE),
    }),
  );

  await page.route("**/route/v1/driving/**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(ROUTE),
    }),
  );

  await page.route("**/nominatim.openstreetmap.org/search**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(PLACES),
    }),
  );
}

export async function openMapFor(page: Page, label: string) {
  const modal = page.locator(".map-card.is-modal");
  if (!(await modal.isVisible().catch(() => false))) {
    const trigger = page
      .locator(".map-preview-pick")
      .filter({ hasText: label })
      .first();
    if (await trigger.isVisible().catch(() => false)) {
      await trigger.click();
    } else {
      await page.locator("#route-open-map").click();
    }
  }

  await expect(modal).toBeVisible();
  return modal;
}

export async function pickAddress(
  page: Page,
  label: string,
  query: string,
) {
  await openMapFor(page, label);
  const input = page.locator(".map-search input");
  await input.fill(query);
  const first = page.locator(".map-result").first();
  await expect(first).toBeVisible();
  await first.click();
  await expect(
    page.getByRole("button", { name: "Simpan titik" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Simpan titik" }).click();
  await expect(page.locator(".map-card.is-modal")).toHaveCount(0);
}
