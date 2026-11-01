import { chromium } from "playwright";

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://localhost:5199", { waitUntil: "networkidle" });
await page.waitForTimeout(900);
const map = page.locator(".leaflet-container");
const modal = page.locator(".map-card.is-modal");
const save = page.getByRole("button", { name: "Simpan titik" });

for (const group of ["is-load", "is-unload"]) {
  await page.locator(`.map-preview-group.${group} .map-preview-pick`).first().click();
  await page.waitForTimeout(800);
  const box = await map.boundingBox();
  await map.click({ position: { x: box.width * 0.4, y: box.height * 0.45 } });
  await page.waitForTimeout(250);
  await save.click();
  await page.waitForTimeout(300);
}
await page.waitForTimeout(3000);

const viewport = page.viewportSize();
console.log("viewport:", viewport);
console.log("scrollWidth:", await page.evaluate(() => document.documentElement.scrollWidth));
for (const sel of [
  ".map-preview-group.is-load .map-preview-add",
  ".map-preview-group.is-unload .map-preview-add",
  ".map-preview-group.is-load .map-preview-action",
  ".map-preview-group.is-load .map-preview-remove",
  ".map-preview-group.is-unload .map-preview-action",
  ".map-preview-group.is-unload .map-preview-remove",
]) {
  const loc = page.locator(sel).first();
  const box = await loc.boundingBox();
  console.log(sel, "visible:", await loc.isVisible(), "box:", box);
}
await page.locator(".map-preview").screenshot({ path: "C:/Users/ThinkPad/AppData/Local/Temp/opencode/preview-mobile.png" });
await browser.close();
