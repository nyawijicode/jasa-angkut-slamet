# Jasa Angkut Slamet 🚚

Aplikasi web modern untuk kalkulasi ongkos angkutan barang, pindahan rumah/kantor, dan kiriman usaha secara transparan, lengkap dengan penandaan rute di peta interaktif dan integrasi pemesanan langsung ke WhatsApp tanpa perlu instalasi aplikasi tambahan.

Melayani area **Mranggen**, **Demak**, **Kebonbatur**, **Semarang**, serta rute luar kota se-Pulau Jawa.

---

## 🌟 Fitur Utama

- **🗺️ Peta Interaktif & Penentuan Rute**:
  - Peta interaktif (MapLibre / OpenFreeMap Liberty) dibuka dalam modal per titik: pilih satu titik (misalnya **M1** atau **B1**), tandai di peta, lalu tekan **Simpan titik** dan modal otomatis tertutup.
  - Tampilan bawaan datar (2D) memakai style **Liberty** sehingga seluruh label jalan, nama tempat, dan POI tetap terlihat. Tombol **3D** di peta mengubahnya menjadi perspektif dengan bangunan timbul, dan bisa dikembalikan ke tampilan datar kapan saja.
  - Penandaan banyak titik muat (jemput) dan bongkar (tujuan) langsung di peta, dengan label **M1, M2, B1, B2**, dan seterusnya.
  - Titik bisa dipilih lewat klik peta, pencarian alamat, atau deteksi lokasi; perubahan baru tersimpan setelah **Simpan titik** ditekan, dan tombol **Batal** membuang pilihan.
  - Default 1 titik muat dan 1 titik bongkar; titik tambahan bisa ditambah atau dihapus kapan saja dari daftar titik di halaman.
  - Pencarian alamat cepat menggunakan layanan geocoding OpenStreetMap Nominatim.
  - Tombol deteksi lokasi otomatis (_Geolocation_).
  - Rute mobil mengikuti jalan sebenarnya (profil _driving_ OSRM), bukan garis lurus, dan otomatis menyesuaikan urutan seluruh titik.
  - Pilihan titik aktif yang jelas, lengkap dengan penanda di peta.

- **📊 Kalkulator Ongkos Otomatis & Transparan**:
  - Perhitungan jarak kilometer otomatis mengikuti rute jalan (_dalam kota_ antar semua titik, _luar kota_ termasuk perjalanan dari dan kembali ke garasi).
  - Pilihan layanan: **Dalam Kota** dan **Luar Kota**.
  - Pilihan bantuan tenaga bongkar muat: _Bongkar sendiri (Gratis)_, _Sopir ikut bongkar muat_, atau _Sopir + Kenek_.
  - Biaya tambahan tangga / lantai bertingkat dihitung untuk setiap titik muat dan bongkar (lantai 1 s/d 20).
  - Rincian biaya transparan yang dapat dilihat langsung oleh pelanggan.

- **📋 Form Pemesanan Bertahap (Multi-Step Wizard)**:
  1. **Langkah 1 (Rute angkutan)**: Tandai titik muat dan bongkar di peta, cari alamat, atau pakai lokasi saat ini. Jarak dan rute mobil dihitung otomatis.
  2. **Langkah 2 (Data pemesan)**: Nama lengkap, nomor WhatsApp yang tervalidasi, serta pemilihan jadwal angkut (tanggal dan selektor jam & menit yang responsif dengan pengelompokan waktu Pagi, Siang, Sore, Malam).
  3. **Langkah 3 (Layanan)**: Pilihan jangkauan wilayah (Dalam Kota vs Luar Kota).
  4. **Langkah 4 (Bantuan & Lantai)**: Pilihan bantuan tenaga angkut dan pengaturan lantai untuk masing-masing titik muat dan bongkar.
  5. **Langkah 5 (Catatan Tambahan)**: Keterangan khusus seputar muatan beserta saran catatan cepat (misal: _butuh terpal_, _gang sempit_, _barang pecah belah_).
  6. **Langkah 6 (Ringkasan Estimasi)**: Tinjauan lengkap data pemesan, rute, rincian biaya estimasi, peringatan jika rute peta belum dipilih, dan tombol konfirmasi pesanan.

- **💬 Integrasi Direct WhatsApp**:
  - Menyusun format pesan WhatsApp yang rapi, profesional, dan lengkap secara otomatis sesuai data yang dimasukkan pelanggan.
  - Data pesanan hanya dikirim saat pelanggan menekan tombol WhatsApp.

- **📱 Mobile-Friendly & Responsif**:
  - Antarmuka ramah perangkat seluler dengan _bar_ estimasi biaya melayang (_sticky mobile bar_) di bagian bawah layar ponsel.

---

## 🛠️ Teknologi yang Digunakan

- **Frontend Core**: [React 18](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite 8](https://vitejs.dev/)
- **Peta & Geospasial**: [MapLibre GL JS](https://maplibre.org/), [OpenFreeMap](https://openfreemap.org/), OpenStreetMap
- **Validasi Data**: Validasi form dan nomor telepon tanpa dependensi tambahan
- **Pengujian (Testing)**: [Vitest](https://vitest.dev/), [Testing Library](https://testing-library.com/), [Playwright](https://playwright.dev/)
- **Styling**: Modern Vanilla CSS dengan CSS Custom Properties (Design Tokens)

---

## 🚀 Memulai (Panduan Instalasi)

### Prasyarat

- Pastikan telah menginstal [Node.js](https://nodejs.org/) **20.19+ atau 22.12+** dan `npm`.
  Vite 8 dan Playwright 1.64 tidak mendukung Node 18. Versi yang dipakai proyek
  tercatat di `.nvmrc` dan `engines` pada `package.json`, jadi `nvm use` akan
  memilih Node 22.

### Langkah Instalasi

1. **Clone repositori**:

   ```bash
   git clone https://github.com/username/jasa-angkut-slamet.git
   cd jasa-angkut-slamet
   ```

2. **Instal dependensi**:

   ```bash
   npm install
   ```

3. **Jalankan server pengembangan (Development)**:
   ```bash
   npm run dev
   ```
   Buka peramban pada alamat [http://localhost:5173](http://localhost:5173).

---

## 📜 Perintah yang Tersedia (NPM Scripts)

| Perintah               | Deskripsi                                                                         |
| ---------------------- | --------------------------------------------------------------------------------- |
| `npm run dev`          | Menjalankan server pengembangan Vite secara lokal                                 |
| `npm run build`        | Menjalankan type-checking TypeScript dan membuat build produksi di folder `dist/` |
| `npm run preview`      | Meninjau hasil build produksi secara lokal                                        |
| `npm test`             | Menjalankan seluruh pengujian unit menggunakan Vitest                             |
| `npm run test:watch`   | Menjalankan Vitest dalam mode watch                                               |
| `npm run e2e`          | E2E Chromium mobile + desktop (memakai Chrome lokal)                              |
| `npm run e2e:all`      | E2E semua project, termasuk WebKit mobile Safari                                  |
| `npm run images`       | Membuat varian WebP dan AVIF dari JPG galeri (butuh `sharp`)                      |
| `npm run validate:seo` | Memvalidasi JSON-LD, FAQ, galeri, dan tarif di `index.html`                       |
| `npm run perf`         | Mengukur LCP/CLS build produksi di desktop dan mobile                             |
| `npm run lint`         | Menjalankan linter ESLint dan type-checking TypeScript                            |
| `npm run check`        | Rangkaian lengkap: lint, unit test, validasi SEO, dan build                       |

---

## 📁 Struktur Direktori

```text
jasa-angkut-slamet/
├── assets/
│   └── originals/          # Foto & ikon sumber, tidak ikut build
├── e2e/
│   └── home.spec.ts        # Smoke test Playwright (copy, overflow, tap target, modal)
├── public/                 # Asset statis publik (gambar teroptimasi, ikon, manifest)
│   └── fonts/              # Font Manrope & Inter (self-hosted, latin + latin-ext)
├── src/
│   ├── components/
│   │   └── MapCanvas.tsx   # Peta MapLibre, rute, dan marker
│   ├── config/
│   │   └── business.ts     # Konfigurasi data bisnis, garasi, dan tarif
│   ├── domain/             # Logika inti bisnis
│   │   ├── customer.ts     # Validasi nama & nomor HP pemesan
│   │   ├── phone.ts        # Validasi format nomor telepon Indonesia
│   │   ├── pricing.ts      # Rumus kalkulasi biaya angkutan & lantai
│   │   ├── schedule.ts     # Pemformat tanggal & waktu jemput
│   │   ├── types.ts        # Deklarasi tipe TypeScript (Service, Helper, dll)
│   │   └── whatsapp.ts     # Generator link & template pesan WhatsApp
│   ├── pages/
│   │   └── Home.tsx        # Halaman utama aplikasi (Peta, Wizard Form, Ringkasan)
│   ├── services/
│   │   └── geocoding.ts    # Layanan pencarian alamat OSM Nominatim
│   ├── styles/
│   │   ├── fonts.css       # Deklarasi @font-face font self-hosted
│   │   ├── base.css        # Reset CSS dasar
│   │   ├── tokens.css      # Variabel warna, tipografi, dan spasi
│   │   ├── refresh.css     # Lapisan visual & responsif
│   │   ├── design.css      # Penerapan DESIGN.md (layout, komponen, override)
│   │   └── ui.css          # Desain komponen antarmuka aplikasi
│   ├── App.tsx             # Root component
│   └── main.tsx            # Entry point aplikasi
├── .gitignore              # Daftar berkas/folder yang diabaikan Git
├── index.html              # Template HTML utama
├── package.json            # Konfigurasi paket & dependensi
├── playwright.config.ts    # Konfigurasi Playwright (testDir, mobile Chrome, web server)
├── tsconfig.json           # Konfigurasi TypeScript
└── vite.config.ts          # Konfigurasi Vite & Vitest
```

---

## 🧪 Pengujian

**Unit test (Vitest)** mencakup rumus tarif, format jadwal, validasi nomor HP,
validasi data pemesan, dan isi pesan WhatsApp:

```bash
npm test
```

**E2E (Playwright)** menjalankan alur nyata di Chromium mobile dan desktop:
tampilan 320px tanpa overflow, target sentuh 44px, menu mobile, modal galeri,
pencarian alamat dengan keyboard, status kosong/gagal pencarian, pesan lokasi
inline, serta wizard lengkap sampai tautan WhatsApp. Peta, OSRM, dan Nominatim
distub pada level network agar tes tetap cepat dan tidak bergantung layanan
pihak ketiga.

```bash
npm run e2e        # Chromium mobile + desktop, memakai Chrome lokal
npm run e2e:all    # termasuk WebKit (iPhone 13), perlu npx playwright install webkit
```

Di CI semua browser yang dibutuhkan dipasang otomatis. Di lokal, `npm run e2e`
memakai Google Chrome sehingga tidak perlu unduh browser tambahan. Playwright
menjalankan `npm run dev -- --port 5199` bila server belum aktif.

**Baseline performa produksi** diukur dari `vite preview`, bukan dev server:

```bash
npm run build
npm run perf
```

Baseline lokal berada di bawah ambang 2,5 detik (contoh pengukuran: LCP desktop
1,2–1,9 detik, mobile 0,5–1,4 detik; CLS desktop sekitar 0,002 dan mobile
sekitar 0,018, jauh di bawah ambang 0,1). Angka bervariasi sesuai beban mesin;
angka produksi tetap perlu dicek dengan Lighthouse/Web Vitals setelah deploy.

**Validasi structured data** memastikan semua blok JSON-LD valid, tipe yang
dibutuhkan ada, FAQ memiliki jawaban, galeri memiliki dimensi gambar, dan
`priceRange` memakai tarif nyata (Rp 6.500/km + setoran Rp 50.000), bukan angka
karangan:

```bash
npm run validate:seo
```

Validasi ini bersifat struktural. Setelah deploy, jalankan URL publik melalui
[Google Rich Results Test](https://search.google.com/test/rich-results) untuk
memastikan tidak ada peringatan yang hanya muncul di lingkungan Google.

---

## 🖼️ Optimasi Gambar

Galeri memakai `<picture>` dengan urutan AVIF, WebP, lalu JPG sebagai fallback.
Varian modern dibuat dari JPG yang sudah ada, sehingga foto asli tidak berubah:

```bash
npm run images
```

Script hanya membuat ulang varian yang lebih lama dari JPG sumber. JPG tetap
dipertahankan untuk browser lama, sitemap gambar, dan pratinjau sosial.

---

## 🔐 Privasi, Analitik, dan CI

- Halaman `/privasi.html` menjelaskan data pemesanan, layanan peta pihak ketiga,
  analitik anonim, dan ketentuan pemesanan. Tautannya ada di footer dan sitemap.
- Event analitik (`wizard_started`, `estimate_ready`, `wizard_completed`,
  `whatsapp_click`, `map_opened`) tidak pernah memuat nama, nomor HP, alamat,
  atau koordinat. Secara bawaan event hanya dikirim ke `dataLayer`/CustomEvent.
  Untuk mengaktifkan pengiriman, set `VITE_ANALYTICS_ENDPOINT` saat build.
- CI di `.github/workflows/ci.yml` menjalankan lint, unit test, validasi JSON-LD,
  build, lalu E2E Chromium + WebKit pada setiap push/PR ke `main`.

---

## ⚙️ Konfigurasi Bisnis & Tarif

Seluruh parameter bisnis (nomor WhatsApp, titik garasi, tarif dasar per km, biaya bantuan tenaga, biaya waktu tunggu, dan biaya per lantai) dapat disesuaikan pada berkas:

📁 **`src/config/business.ts`**

```typescript
export const BUSINESS = {
  name: "Jasa Angkut Slamet",
  whatsapp: "6281327623942",
  phoneDisplay: "0813-2762-3942",
  garage: {
    label: "Garasi Jasa Angkut Slamet",
    address: "Jl. Kb. Rejo Raya Timur Raya No.11, Kebonbatur, Mranggen, Demak",
    lat: -7.056966,
    lng: 110.496811,
  },
  pricing: {
    perKm: 6500, // Biaya per km
    setoran: 50000, // Jasa  Sopir Tetap
    helper: {
      none: 0, // Bongkar muat sendiri
      driver: 65000, // Sopir ikut bongkar muat
      driverAndAssistant: 130000, // Sopir + Kenek
    },
    waitingTime: {
      none: 0,
      over30: 18000, // Lebih dari 30 menit
      min60: 36000, // 60 menit
      min90: 72000, // 90 menit
    },
    floor: {
      first: 20000, // Biaya naik ke lantai 2
      next: 10000, // Biaya tambahan per lantai berikutnya
      max: 20,
    },
  },
};
```

Jarak yang ditagihkan dihitung dari **garasi → titik muat → titik bongkar → garasi**.
Semua titik muat/bongkar dijumlahkan sesuai urutan, lalu dibulatkan ke atas per km.
Biaya layanan (bantuan tenaga, lantai, prioritas, dan waktu tunggu) ditambahkan
setelah ongkos angkut.

---

## 📄 Lisensi

Hak Cipta © 2026 [Jasa Angkut Slamet](https://wa.me/6281327623942). Semua hak dilindungi undang-undang.
