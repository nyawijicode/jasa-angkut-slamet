# Jasa Angkut Slamet 🚚

Aplikasi web modern untuk kalkulasi ongkos angkutan barang, pindahan rumah/kantor, dan kiriman usaha secara transparan, lengkap dengan penandaan rute di peta interaktif dan integrasi pemesanan langsung ke WhatsApp tanpa perlu instalasi aplikasi tambahan.

Melayani area **Mranggen**, **Demak**, **Kebonbatur**, **Semarang**, serta rute luar kota se-Pulau Jawa.

---

## 🌟 Fitur Utama

- **🗺️ Peta Interaktif & Penentuan Rute**:
  - Peta interaktif (MapLibre / OpenFreeMap) dibuka dalam modal per titik: pilih satu titik (misalnya **M1** atau **B1**), tandai di peta, lalu tekan **Simpan titik** dan modal otomatis tertutup.
  - Tampilan peta memakai vektor tiles dengan bangunan 3D saat diperbesar, sehingga titik muat dan bongkar lebih mudah dikenali.
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
  1. **Langkah 1 (Data Pemesan)**: Nama lengkap, nomor WhatsApp yang tervalidasi, serta pemilihan jadwal angkut (tanggal dan selektor jam & menit yang responsif dengan pengelompokan waktu Pagi, Siang, Sore, Malam).
  2. **Langkah 2 (Layanan)**: Pilihan jangkauan wilayah (Dalam Kota vs Luar Kota).
  3. **Langkah 3 (Bantuan & Lantai)**: Pilihan bantuan tenaga angkut dan pengaturan lantai untuk masing-masing titik muat dan bongkar.
  4. **Langkah 4 (Catatan Tambahan)**: Keterangan khusus seputar muatan beserta saran catatan cepat (misal: _butuh terpal_, _gang sempit_, _barang pecah belah_).
  5. **Langkah 5 (Ringkasan Estimasi)**: Tinjauan lengkap data pemesan, rute, rincian biaya estimasi, peringatan jika rute peta belum dipilih, dan tombol konfirmasi pesanan.

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

- Pastikan telah menginstal [Node.js](https://nodejs.org/) (versi 18 ke atas disarankan) dan `npm`.

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

| Perintah             | Deskripsi                                                                         |
| -------------------- | --------------------------------------------------------------------------------- |
| `npm run dev`        | Menjalankan server pengembangan Vite secara lokal                                 |
| `npm run build`      | Menjalankan type-checking TypeScript dan membuat build produksi di folder `dist/` |
| `npm run preview`    | Meninjau hasil build produksi secara lokal                                        |
| `npm test`           | Menjalankan seluruh pengujian unit menggunakan Vitest                             |
| `npm run test:watch` | Menjalankan Vitest dalam mode watch                                               |
| `npm run e2e`        | Menjalankan pengujian end-to-end dengan Playwright                                |
| `npm run lint`       | Menjalankan linter ESLint dan type-checking TypeScript                            |

---

## 📁 Struktur Direktori

```text
jasa-angkut-slamet/
├── assets/
│   └── originals/          # Foto & ikon sumber, tidak ikut build
├── e2e/
│   └── home.spec.ts        # Smoke test Playwright (copy, overflow, tap target, modal)
├── public/                 # Asset statis publik (gambar teroptimasi, ikon, manifest)
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
│   │   ├── base.css        # Reset CSS dasar
│   │   ├── tokens.css      # Variabel warna, tipografi, dan spasi
│   │   ├── refresh.css     # Lapisan visual & responsif
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

**Smoke test end-to-end (Playwright)** memeriksa tampilan mobile 320px, tidak ada
overflow horizontal, target sentuh minimal 44px, menu mobile, dan modal galeri:

```bash
npm run e2e
```

Playwright memakai Google Chrome (`channel: "chrome"`), jadi tidak perlu mengunduh
browser tambahan. Jika server dev belum berjalan, Playwright otomatis menjalankan
`npm run dev -- --port 5199`; bila sudah ada, server tersebut dipakai ulang.

Nama dan nomor HP wajib valid sebelum pesanan bisa dikirim ke WhatsApp. Aturan ini
diuji di `src/domain/customer.test.ts` dan dipakai langsung oleh wizard di
`src/pages/Home.tsx`, sehingga tombol WhatsApp tidak pernah menghasilkan pesan tanpa
identitas pemesan.

---

## ⚙️ Konfigurasi Bisnis & Tarif

Seluruh parameter bisnis (nomor WhatsApp, titik garasi, tarif dasar per km, biaya bantuan tenaga, dan biaya per lantai) dapat disesuaikan pada berkas:

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
    setoran: 50000, // Biaya dasar angkutan
    helper: {
      none: 0, // Bongkar muat sendiri
      driver: 50000, // Sopir ikut bongkar muat
      driverAndAssistant: 100000, // Sopir + Kenek
    },
    floor: {
      first: 20000, // Biaya naik ke lantai 2
      next: 10000, // Biaya tambahan per lantai berikutnya
      max: 20,
    },
  },
};
```

---

## 📄 Lisensi

Hak Cipta © 2026 [Jasa Angkut Slamet](https://wa.me/6281327623942). Semua hak dilindungi undang-undang.
