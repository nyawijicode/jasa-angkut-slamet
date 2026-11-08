export const BUSINESS = {
  name: "Jasa Angkut Slamet",
  whatsapp: "6281327623942",
  phoneDisplay: "0813-2762-3942",
  garage: {
    label: "Garasi Jasa Angkut Slamet",
    address:
      "Jl. Kb. Rejo Raya Timur Raya No.11, RT.13/RW.13, Rawa, Kebonbatur, Kec. Mranggen, Kabupaten Demak, Jawa Tengah 59567",
    lat: -7.056966,
    lng: 110.496811,
  },
  pricing: {
    perKm: 6500,
    setoran: 50000,
    kmPerLiter: 10,
    helper: { none: 0, driver: 50000, driverAndAssistant: 100000 } as const,
    floor: { first: 20000, next: 10000, max: 20 },
    roundKm: "ceil" as const,
    outOfTownSurchargeRate: 0.5,
  },
  social: {
    instagram: "https://www.instagram.com/jasaangkutslamet.mranggen/",
    tiktok: "https://www.tiktok.com/@jasaangkutslametmranggen",
    facebook:
      "https://www.facebook.com/people/Jasa-Angkut-Slamet-Kebonbatur-Mranggen-Demak/61592066215524/",
  },
} as const;
