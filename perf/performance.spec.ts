import { test, expect } from "playwright/test";

const observe = () => {
  const state = { lcp: 0, cls: 0 };
  Object.defineProperty(window, "__perf", { value: state });

  new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const last = entries[entries.length - 1] as
      | (PerformanceEntry & { renderTime?: number; loadTime?: number })
      | undefined;
    if (last) {
      state.lcp = last.renderTime || last.loadTime || last.startTime;
    }
  }).observe({ type: "largest-contentful-paint", buffered: true });

  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as Array<
      PerformanceEntry & { value: number; hadRecentInput: boolean }
    >) {
      if (!entry.hadRecentInput) state.cls += entry.value;
    }
  }).observe({ type: "layout-shift", buffered: true });
};

test.describe("production performance baseline", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(observe);
  });

  for (const viewport of [
    { name: "desktop", width: 1280, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    test(`LCP dan CLS ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/", { waitUntil: "networkidle" });
      await page.waitForTimeout(2500);

      const metrics = await page.evaluate(() => {
        const state = (
          window as unknown as {
            __perf: { lcp: number; cls: number };
          }
        ).__perf;
        return {
          lcp: Math.round(state.lcp),
          cls: Number(state.cls.toFixed(4)),
        };
      });

      console.log(`${viewport.name}:`, JSON.stringify(metrics));

      expect(metrics.cls, "CLS harus <= 0.1").toBeLessThanOrEqual(0.1);
      expect(
        metrics.lcp,
        "LCP harus <= 2500 ms pada build produksi lokal",
      ).toBeLessThanOrEqual(2500);
    });
  }
});
