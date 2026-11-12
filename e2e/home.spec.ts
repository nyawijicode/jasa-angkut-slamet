import { expect, test, type Page } from "playwright/test";
import { installMapStubs, openBooking } from "./stubs";

const MIN_TARGET = 44;

async function anchorTop(page: Page, id: string) {
  return page.evaluate(
    (anchorId) =>
      Math.round(
        document.getElementById(anchorId)!.getBoundingClientRect().top,
      ),
    id,
  );
}

async function anchorViewportOffset(page: Page, id: string) {
  return page.evaluate((anchorId) => {
    const el = document.getElementById(anchorId)!;
    const header = document.querySelector(".site-header") as HTMLElement;
    const margin = Number.parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
    return Math.max(margin, header.getBoundingClientRect().height + 16);
  }, id);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("menampilkan tarif transparan tanpa overflow horizontal", async ({
  page,
}) => {
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Pindahan Lebih Tenang",
  );
  await expect(page.locator(".hero-visual-rate")).toContainText("Rp 50.000");
  await expect(page.locator(".faq-answer").first()).toContainText("Rp 50.000");
  await expect(page.locator(".mobile-bar-note")).toContainText("Rp 50.000");

  for (const width of [320, 360, 375, 390, 414, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(120);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, `overflow horizontal di ${width}px`).toBeLessThanOrEqual(0);
  }
});

test("menjaga target sentuh minimal 44px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  // Let the min-height transition finish after the viewport change.
  await page.waitForTimeout(350);

  const tooSmall = await page.evaluate((min) => {
    const selector =
      'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])';
    const failures: string[] = [];

    document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        rect.width === 0 ||
        rect.height === 0
      ) {
        return;
      }

      // Tautan inline di dalam paragraf dikecualikan (WCAG 2.5.8).
      if (el.tagName === "A" && !el.className && el.closest("p")) return;

      if (rect.width < min || rect.height < min) {
        failures.push(
          `${el.tagName.toLowerCase()}.${el.className || "-"}: ${Math.round(rect.width)}x${Math.round(rect.height)}`,
        );
      }
    });

    return failures;
  }, MIN_TARGET);

  expect(tooSmall).toEqual([]);
});

test("menu mobile tertutup dengan Escape dan klik luar", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  const burger = page.locator(".nav-burger");

  await burger.click();
  await expect(burger).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#mobile-menu")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(burger).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#mobile-menu")).toHaveCount(0);
  await expect(burger).toBeFocused();

  await burger.click();
  await page.locator(".site-topbar").click();
  await expect(burger).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#mobile-menu")).toHaveCount(0);

  await burger.click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator("#mobile-menu")).toHaveCount(0);
});

test("halaman privasi terbuka dari footer tanpa overflow", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });

  const link = page.locator(".footer-legal-link");
  await expect(link).toBeVisible();
  await link.click();

  await expect(page).toHaveURL(/\/privasi\.html$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Kebijakan privasi",
  );

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("klik navigasi desktop langsung mendarat di section tujuan", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(400);

  const offset = await anchorViewportOffset(page, "galeri");
  await page.locator('.header-nav a[href="#galeri"]').click();

  // A -> D langsung mendarat: section tujuan sudah menempel di bawah header,
  // bukan masih di tengah perjalanan melewati section lain.
  expect(Math.abs((await anchorTop(page, "galeri")) - offset)).toBeLessThanOrEqual(
    8,
  );
  await expect(page).toHaveURL(/#galeri$/);

  await page.waitForTimeout(600);
  // Setelah layout stabil, section tujuan tetap menempel di bawah header.
  expect(Math.abs((await anchorTop(page, "galeri")) - offset)).toBeLessThanOrEqual(
    4,
  );
  await expect(page.locator('.header-nav a[href="#galeri"]')).toHaveClass(
    /is-active/,
  );
});

test("navigasi mobile langsung mendarat di section tujuan", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);

  const measure = () =>
    page.evaluate(() => ({
      doc: document.documentElement.scrollHeight,
      header: Math.round(
        document.querySelector(".site-header")!.getBoundingClientRect().height,
      ),
    }));

  await page.locator(".nav-burger").click();
  await expect(page.locator("#mobile-menu")).toBeVisible();
  await page.waitForTimeout(250);

  // Menu harus menjadi overlay, bukan ikut alur dokumen.
  await expect(page.locator("#mobile-menu")).toHaveCSS("position", "absolute");
  const open = await measure();

  const offset = await anchorViewportOffset(page, "galeri");

  await page.locator('.mobile-menu a[href="#galeri"]').click();

  // Langsung mendarat di tujuan, tidak mampir ke section lain di antaranya.
  expect(Math.abs((await anchorTop(page, "galeri")) - offset)).toBeLessThanOrEqual(
    8,
  );

  await expect(page).toHaveURL(/#galeri$/);
  await page.waitForTimeout(600);
  expect(Math.abs((await anchorTop(page, "galeri")) - offset)).toBeLessThanOrEqual(
    4,
  );

  const closed = await measure();
  expect(open.doc).toBe(closed.doc);
  expect(open.header).toBe(closed.header);

  await expect(page.locator('.header-nav a[href="#galeri"]')).toHaveClass(
    /is-active/,
  );
});

test("modal peta responsif di 320px dengan toggle 3D", async ({ page }) => {
  await installMapStubs(page);
  await page.setViewportSize({ width: 320, height: 720 });
  await openBooking(page);
  await page.locator("#route-open-map").click();

  const modal = page.locator(".map-card.is-modal");
  await expect(modal).toBeVisible();
  await expect(page.getByRole("button", { name: "Tampilan 3D" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator(".map-search input")).toBeVisible();
  await expect(page.getByRole("button", { name: "Lokasi saya" })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("modal galeri mengunci fokus dan menutup dengan Escape", async ({
  page,
}) => {  const trigger = page.locator(".gallery-open");
  const modal = page.locator(".gallery-modal");

  await expect(page.locator(".gallery-track > li")).toHaveCount(6);
  const nonListChildren = await page.evaluate(() =>
    Array.from(document.querySelector(".gallery-track")?.children ?? [])
      .filter((el) => el.tagName !== "LI")
      .map((el) => el.tagName),
  );
  expect(nonListChildren).toEqual([]);

  await trigger.click();
  await expect(modal).toBeVisible();
  await expect(page.locator(".gallery-modal-close")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
