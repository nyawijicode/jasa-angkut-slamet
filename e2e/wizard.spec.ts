import { test, expect } from "playwright/test";
import {
  installMapStubs,
  openMapFor,
  pickAddress,
  PLACES,
} from "./stubs";

test.describe("wizard pesanan", () => {
  test.beforeEach(async ({ page }) => {
    await installMapStubs(page);
    await page.goto("/");
  });

  test("menyelesaikan alur rute sampai tautan WhatsApp", async ({
    page,
  }) => {
    await pickAddress(page, "M1", "Mranggen");
    await pickAddress(page, "B1", "Semarang");

    await expect(page.locator(".route-sequence-meta")).toContainText("km");
    await page
      .getByRole("button", { name: /^Lanjut$/i })
      .click();

    await expect(page.locator("#wizard-step-title")).toHaveText(
      "Data pemesan",
    );

    await page.getByRole("button", { name: /^Lanjut$/i }).click();
    await expect(page.locator("#name-error")).toBeVisible();
    await expect(page.locator("#phone-error")).toBeVisible();
    await expect(page.locator("#wizard-step-title")).toHaveText(
      "Data pemesan",
    );

    await page.locator("#customer-name").fill("Budi Santoso");
    await page.locator("#customer-phone").fill("081327623942");
    await page.getByRole("button", { name: /^Lanjut$/i }).click();

    await expect(page.locator("#wizard-step-title")).toHaveText("Layanan");
    await page
      .getByRole("button", { name: /^Lanjut$/i })
      .click();
    await expect(page.locator("#wizard-step-title")).toHaveText(
      "Bantuan & lantai",
    );
    await page.getByRole("button", { name: /^Lanjut$/i }).click();
    await expect(page.locator("#wizard-step-title")).toHaveText(
      "Catatan tambahan",
    );
    await page
      .getByRole("button", { name: /^Lanjut$/i })
      .click();

    await expect(page.locator("#wizard-step-title")).toHaveText(
      "Ringkasan estimasi",
    );
    await expect(page.locator(".order-review-card")).toContainText(
      "Budi Santoso",
    );
    await expect(page.locator(".order-review-card")).toContainText(
      "081327623942",
    );
    await expect(page.locator(".quote-total")).toContainText("Rp");

    const waLink = page.getByRole("link", {
      name: /Kirim pesanan ke WhatsApp/,
    });
    await expect(waLink).toBeVisible();
    const href = await waLink.getAttribute("href");
    expect(href).toContain("https://wa.me/");
    expect(href).toContain("text=");

    const message = decodeURIComponent(href!.split("text=")[1]);
    expect(message).toContain("PESANAN JASA ANGKUT SLAMET");
    expect(message).toContain("Budi Santoso");
    expect(message).toContain("081327623942");
    expect(message).toContain("Mranggen");
    expect(message).toContain("Titik Muat");
    expect(message).toContain("Titik Bongkar");
    expect(message).toContain("*TOTAL: Rp");
  });

  test("toggle prioritas menambah Rp 50.000 dan teks WhatsApp", async ({
    page,
  }) => {
    await pickAddress(page, "M1", "Mranggen");
    await pickAddress(page, "B1", "Semarang");

    await page.getByRole("button", { name: /^Lanjut$/i }).click();
    await page.locator("#customer-name").fill("Siti Aminah");
    await page.locator("#customer-phone").fill("081234567890");
    await page.getByRole("button", { name: /^Lanjut$/i }).click();

    // Prioritas adalah opsi layanan, jadi ada di tab Layanan.
    const toggle = page.getByRole("switch", {
      name: "Toggle prioritas pengiriman langsung",
    });
    const card = page.locator(".priority-toggle-card");

    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(card).toContainText("+Rp 50.000");
    await expect(card.locator(".priority-badge")).toContainText("Rp");

    // Bisa dinonaktifkan jika pelanggan mau menunggu (jadwal reguler)
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(card).toContainText("maksimal 4 jam");

    // Aktifkan kembali agar prioritas ikut dihitung
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");

    // Layanan -> Bantuan & lantai -> Catatan -> Ringkasan
    await page.getByRole("button", { name: /^Lanjut$/i }).click();
    await page.getByRole("button", { name: /^Lanjut$/i }).click();
    await page.getByRole("button", { name: /^Lanjut$/i }).click();

    await expect(page.locator(".order-review-card")).toContainText(
      "Prioritas Langsung",
    );
    await expect(
      page.locator(".quote-line").filter({ hasText: "Prioritas pengiriman" }),
    ).toContainText("Rp 50.000");

    const waLink = page.getByRole("link", {
      name: /Kirim pesanan ke WhatsApp/,
    });
    const href = await waLink.getAttribute("href");
    const message = decodeURIComponent(href!.split("text=")[1]);
    expect(message).toContain("[PRIORITAS]");
    expect(message).toContain("Rp 50.000");
  });

  test("layanan waktu tunggu menambah biaya sesuai pilihan", async ({
    page,
  }) => {
    await pickAddress(page, "M1", "Mranggen");
    await pickAddress(page, "B1", "Semarang");

    await page.getByRole("button", { name: /^Lanjut$/i }).click();
    await page.locator("#customer-name").fill("Siti Aminah");
    await page.locator("#customer-phone").fill("081234567890");
    await page.getByRole("button", { name: /^Lanjut$/i }).click();

    const group = page.getByRole("radiogroup", {
      name: "Layanan waktu tunggu",
    });
    const cards = group.getByRole("radio");
    await expect(cards).toHaveCount(4);
    await expect(cards.nth(0)).toContainText("Tanpa waktu tunggu");
    await expect(cards.nth(0)).toContainText("Gratis");
    await expect(cards.nth(1)).toContainText("Lebih dari 30 menit");
    await expect(cards.nth(1)).toContainText("+Rp18.000");
    await expect(cards.nth(2)).toContainText("60 menit");
    await expect(cards.nth(2)).toContainText("+Rp36.500");
    await expect(cards.nth(3)).toContainText("90 menit");
    await expect(cards.nth(3)).toContainText("+Rp72.000");
    await expect(cards.nth(0)).toHaveAttribute("aria-checked", "true");

    const sixty = group.getByRole("radio", { name: /^60 menit/ });
    await sixty.click();
    await expect(sixty).toHaveAttribute("aria-checked", "true");

    // Layanan -> Bantuan & lantai -> Catatan -> Ringkasan
    await page.getByRole("button", { name: /^Lanjut$/i }).click();
    await page.getByRole("button", { name: /^Lanjut$/i }).click();
    await page.getByRole("button", { name: /^Lanjut$/i }).click();

    await expect(
      page.locator(".quote-line").filter({ hasText: "Waktu tunggu (60 menit)" }),
    ).toContainText("Rp 36.500");
    await expect(page.locator(".order-review-card")).toContainText(
      "60 menit (+Rp 36.500)",
    );

    // Jarak ditagih dari garasi -> muat -> bongkar -> garasi.
    // Stub rute 12,4 km per leg, tiga leg (garasi-muat, muat-bongkar, bongkar-garasi).
    await expect(
      page.locator(".quote-line").filter({ hasText: "Jarak total" }),
    ).toContainText("38 km");

    const waLink = page.getByRole("link", {
      name: /Kirim pesanan ke WhatsApp/,
    });
    const href = await waLink.getAttribute("href");
    const message = decodeURIComponent(href!.split("text=")[1]);
    expect(message).toContain("Waktu tunggu (60 menit): Rp 36.500");
  });

  test("rute tersimpan terkunci sampai Ubah Titik ditekan", async ({
    page,
  }) => {
    await pickAddress(page, "M1", "Mranggen");
    await pickAddress(page, "B1", "Semarang");

    await page.locator(".panel-route-btn").click();
    const modal = page.locator(".map-card.is-modal");
    await expect(modal).toBeVisible();
    await expect(
      modal.getByRole("heading", { name: "Lihat Rute Perjalanan" }),
    ).toBeVisible();
    await expect(modal).toContainText("Rute Tersimpan (Terkunci)");
    await expect(modal.locator(".map-search")).toHaveCount(0);
    await expect(
      modal.getByRole("button", { name: "Lokasi saya" }),
    ).toHaveCount(0);
    await expect(
      modal.getByRole("button", { name: "Ubah Titik" }),
    ).toBeVisible();

    const lockedText = await page.locator(".map-draft").textContent();
    await page
      .locator(".map-libre-canvas")
      .click({ position: { x: 140, y: 160 }, force: true });
    await expect(page.locator(".map-draft")).toHaveText(lockedText!);

    await modal.getByRole("button", { name: "Ubah Titik" }).click();
    await expect(modal.locator(".map-search input")).toBeVisible();
    await expect(
      modal.getByRole("button", { name: "Simpan titik" }),
    ).toBeVisible();
  });

  test("peta bisa beralih dari tampilan datar ke 3D", async ({ page }) => {
    await openMapFor(page, "M1");

    const toggle = page.getByRole("button", { name: "Tampilan 3D" });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(toggle).toBeVisible();

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  test("menampilkan status kosong dan gagal pada pencarian alamat", async ({
    page,
  }) => {
    await openMapFor(page, "M1");

    // One handler with a mutable flag: re-registering the same route does not
    // reliably override the earlier handler across all browsers.
    let failSearch = false;
    await page.route("**/nominatim.openstreetmap.org/search**", (route) =>
      failSearch
        ? route.fulfill({ status: 503, body: "unavailable" })
        : route.fulfill({ contentType: "application/json", body: "[]" }),
    );

    await page.locator(".map-search input").fill("Alamat tidak ada");
    await expect(
      page.getByText(/Alamat tidak ditemukan\. Coba kata kunci lain/),
    ).toBeVisible();

    failSearch = true;
    await page.locator(".map-search input").fill("Alamat gagal");
    await expect(
      page.getByText(/Pencarian alamat sedang tidak tersedia/),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Coba lagi" }),
    ).toBeVisible();
  });

  test("menampilkan pesan lokasi inline tanpa alert", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
          getCurrentPosition: (
            _success: PositionCallback,
            error?: PositionErrorCallback,
          ) => {
            error?.({
              code: 1,
              PERMISSION_DENIED: 1,
              POSITION_UNAVAILABLE: 2,
              TIMEOUT: 3,
              message: "denied",
            } as GeolocationPositionError);
          },
        },
      });
    });
    await page.reload();

    await openMapFor(page, "M1");
    await page.getByRole("button", { name: "Lokasi saya" }).click();
    await expect(page.locator(".map-status")).toContainText(
      "Izin lokasi ditolak",
    );

    const dialogs: string[] = [];
    page.on("dialog", async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });
    await page.getByRole("button", { name: "Lokasi saya" }).click();
    await page.waitForTimeout(200);
    expect(dialogs).toEqual([]);
  });

  test("hasil alamat tetap bisa dipilih dengan keyboard", async ({ page }) => {
    await openMapFor(page, "M1");
    // Keep the pointer away from the results list so that a synthetic
    // mouseenter cannot pre-select an item before the ArrowDown key press.
    await page.mouse.move(0, 0);
    const input = page.locator(".map-search input");
    await input.fill("Mranggen");
    await expect(page.locator(".map-result").first()).toBeVisible();

    await page.keyboard.press("ArrowDown");
    await expect(input).toHaveAttribute(
      "aria-activedescendant",
      "map-result-0",
    );
    await page.keyboard.press("Enter");
    await expect(page.locator(".map-result")).toHaveCount(0);
    await expect(page.locator(".map-draft")).toContainText(
      PLACES[0].display_name,
    );
  });
});

