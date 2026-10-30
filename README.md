# Jasa Angkut Slamet 🚚

Aplikasi web modern untuk kalkulasi ongkos angkutan barang, pindahan rumah/kantor, dan kiriman usaha secara transparan, lengkap dengan penandaan rute di peta interaktif dan integrasi pemesanan langsung ke WhatsApp tanpa perlu instalasi aplikasi tambahan.

Melayani area **Mranggen**, **Demak**, **Kebonbatur**, **Semarang**, serta rute luar kota se-Pulau Jawa.

---

## 🌟 Fitur Utama

- **🗺️ Peta Interaktif & Penentuan Rute**:
  - Penandaan titik muat (jemput) dan titik bongkar (tujuan) langsung di peta interaktif (Leaflet / OpenStreetMap).
  - Pencarian alamat cepat menggunakan layanan geocoding OpenStreetMap Nominatim.
  - Tombol deteksi lokasi otomatis (*Geolocation*).
  - Garis rute visual antara titik muat dan bongkar.
  - Pilihan cepat beralih antara titik muat dan bongkar dengan tampilan status aktif yang jelas.

- **📊 Kalkulator Ongkos Otomatis & Transparan**:
  - Perhitungan jarak kilometer otomatis (*dalam kota* langsung antar titik, *luar kota* mencakup rute dari garasi).
  - Pilihan layanan: **Dalam Kota** dan **Luar Kota**.
  - Pilihan bantuan tenaga bongkar muat: *Bongkar sendiri (Gratis)*, *Sopir ikut bongkar muat*, atau *Sopir + Kenek*.
  - Biaya tambahan tangga / lantai bertingkat di lokasi muat dan bongkar (lantai 1 s/d 20).
  - Rincian biaya transparan yang dapat dilihat langsung oleh pelanggan.

- **📋 Form Pemesanan Bertahap (Multi-Step Wizard)**:
  1. **Langkah 1 (Data Pemesan)**: Nama lengkap, nomor WhatsApp yang tervalidasi, serta pemilihan jadwal angkut (tanggal dan selektor jam & menit yang responsif dengan pengelompokan waktu Pagi, Siang, Sore, Malam).
  2. **Langkah 2 (Layanan)**: Pilihan jangkauan wilayah (Dalam Kota vs Luar Kota).
  3. **Langkah 3 (Bantuan & Lantai)**: Pilihan bantuan tenaga angkut dan pengaturan lantai muat & bongkar.
  4. **Langkah 4 (Catatan Tambahan)**: Keterangan khusus seputar muatan beserta saran catatan cepat (misal: *butuh terpal*, *gang sempit*, *barang pecah belah*).
  5. **Langkah 5 (Ringkasan Estimasi)**: Tinjauan lengkap data pemesan, rute, rincian biaya estimasi, peringatan jika rute peta belum dipilih, dan tombol konfirmasi pesanan.

- **💬 Integrasi Direct WhatsApp**:
  - Menyusun format pesan WhatsApp yang rapi, profesional, dan lengkap secara otomatis sesuai data yang dimasukkan pelanggan.
  - Data pesanan hanya dikirim saat pelanggan menekan tombol WhatsApp.

- **📱 Mobile-Friendly & Responsif**:
  - Antarmuka ramah perangkat seluler dengan *bar* estimasi biaya melayang (*sticky mobile bar*) di bagian bawah layar ponsel.

---

## 🛠️ Teknologi yang Digunakan

- **Frontend Core**: [React 18](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite 5](https://vitejs.dev/)
- **Peta & Geospasial**: [Leaflet](https://leafletjs.com/), [React-Leaflet](https://react-leaflet.js.org/), OpenStreetMap
- **Validasi Data**: [Zod](https://zod.dev/)
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

| Perintah | Deskripsi |
| --- | --- |
| `npm run dev` | Menjalankan server pengembangan Vite secara lokal |
| `npm run build` | Menjalankan type-checking TypeScript dan membuat build produksi di folder `dist/` |
| `npm run preview` | Meninjau hasil build produksi secara lokal |
| `npm test` | Menjalankan seluruh pengujian unit menggunakan Vitest |
| `npm run test:watch` | Menjalankan Vitest dalam mode watch |
| `npm run e2e` | Menjalankan pengujian end-to-end dengan Playwright |
| `npm run lint` | Menjalankan linter ESLint dan type-checking TypeScript |

---

## 📁 Struktur Direktori

```text
jasa-angkut-slamet/
├── public/                 # Asset statis publik
├── src/
│   ├── config/
│   │   └── business.ts     # Konfigurasi data bisnis, garasi, dan tarif
│   ├── domain/             # Logika inti bisnis
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
│   │   └── ui.css          # Desain komponen antarmuka aplikasi
│   ├── App.tsx             # Root component
│   └── main.tsx            # Entry point aplikasi
├── .gitignore              # Daftar berkas/folder yang diabaikan Git
├── index.html              # Template HTML utama
├── package.json            # Konfigurasi paket & dependensi
├── tsconfig.json           # Konfigurasi TypeScript
└── vite.config.ts          # Konfigurasi Vite
```

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
    perKm: 8000,           // Biaya per km
    setoran: 50000,        // Biaya dasar angkutan
    helper: {
      none: 0,             // Bongkar muat sendiri
      driver: 50000,       // Sopir ikut bongkar muat
      driverAndAssistant: 100000, // Sopir + Kenek
    },
    floor: {
      first: 20000,        // Biaya naik ke lantai 2
      next: 10000,         // Biaya tambahan per lantai berikutnya
      max: 20
    },
  },
};
```

---

## 📄 Lisensi

Hak Cipta © 2026 [Jasa Angkut Slamet](https://wa.me/6281327623942). Semua hak dilindungi undang-undang.
