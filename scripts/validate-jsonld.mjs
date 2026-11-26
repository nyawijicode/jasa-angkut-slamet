import { access, readFile } from 'node:fs/promises';

const BASE = 'https://jasa-angkut-slamet.vercel.app';

const pageDefinitions = [
  {
    name: 'index.html',
    url: new URL('../index.html', import.meta.url),
    path: '/',
    titleParts: ['Jasa Angkut Slamet', 'Demak', 'Semarang'],
    descriptionParts: ['0813-2762-3942', '06.00'],
  },
  {
    name: 'hitung-tarif.html',
    url: new URL('../hitung-tarif.html', import.meta.url),
    path: '/hitung-tarif',
    titleParts: ['Hitung Tarif', 'Jasa Angkut Slamet'],
  },
  {
    name: 'layanan.html',
    url: new URL('../layanan.html', import.meta.url),
    path: '/layanan',
    titleParts: ['Layanan', 'Jasa Angkut Slamet'],
  },
  {
    name: 'galeri.html',
    url: new URL('../galeri.html', import.meta.url),
    path: '/galeri',
    titleParts: ['Galeri', 'Jasa Angkut Slamet'],
  },
  {
    name: 'area-layanan.html',
    url: new URL('../area-layanan.html', import.meta.url),
    path: '/area-layanan',
    titleParts: ['Area Layanan', 'Jasa Angkut Slamet'],
  },
  {
    name: 'faq.html',
    url: new URL('../faq.html', import.meta.url),
    path: '/faq',
    titleParts: ['FAQ', 'Jasa Angkut Slamet'],
  },
  {
    name: 'kontak.html',
    url: new URL('../kontak.html', import.meta.url),
    path: '/kontak',
    titleParts: ['Kontak', 'Jasa Angkut Slamet'],
    descriptionParts: ['0813-2762-3942', '06.00'],
  },
  {
    name: 'privasi.html',
    url: new URL('../public/privasi.html', import.meta.url),
    path: '/privasi',
    titleParts: ['Kebijakan Privasi', 'Jasa Angkut Slamet'],
  },
];

const paths = {
  sitemap: new URL('../public/sitemap.xml', import.meta.url),
  robots: new URL('../public/robots.txt', import.meta.url),
  vercel: new URL('../vercel.json', import.meta.url),
};

const sources = {};
for (const page of pageDefinitions) {
  sources[page.name] = await readFile(page.url, 'utf8');
}
for (const [name, path] of Object.entries(paths)) {
  sources[name] = await readFile(path, 'utf8');
}

const problems = [];

const extractBlocks = (html) =>
  [
    ...html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ].map((match) => match[1]);

const blocks = pageDefinitions.flatMap((page) =>
  extractBlocks(sources[page.name]),
);

if (blocks.length === 0) {
  problems.push('Tidak ada blok JSON-LD pada halaman mana pun.');
}
for (const page of pageDefinitions) {
  if (extractBlocks(sources[page.name]).length === 0) {
    problems.push(`${page.name}: tidak memuat blok JSON-LD.`);
  }
}

const documents = blocks.map((block, index) => {
  try {
    return JSON.parse(block);
  } catch (error) {
    problems.push(`Blok JSON-LD #${index + 1} bukan JSON valid: ${error.message}`);
    return null;
  }
});

const flatTypes = documents.flatMap((document) =>
  Array.isArray(document?.['@type'])
    ? document['@type']
    : document?.['@type']
      ? [document['@type']]
      : [],
);

const byType = (type) =>
  documents.find((document) =>
    Array.isArray(document?.['@type'])
      ? document['@type'].includes(type)
      : document?.['@type'] === type,
  );

const requiredTypes = [
  'MovingCompany',
  'WebSite',
  'Service',
  'BreadcrumbList',
  'FAQPage',
  'ImageGallery',
];

for (const type of requiredTypes) {
  if (!flatTypes.includes(type)) {
    problems.push(`Structured data "${type}" tidak ditemukan.`);
  }
}

// Kelima halaman khusus memuat section yang sama dengan homepage, jadi schema
// yang terlihat tidak boleh hilang dari salah satu halaman.
const homepageTypes = new Set(extractBlocks(sources['index.html']).flatMap((block) => {
  const document = JSON.parse(block);
  return Array.isArray(document?.['@type'])
    ? document['@type']
    : document?.['@type']
      ? [document['@type']]
      : [];
}));
for (const page of pageDefinitions.slice(1, -1)) {
  const pageTypes = new Set(
    extractBlocks(sources[page.name]).map((block) => {
      const document = JSON.parse(block);
      return Array.isArray(document?.['@type'])
        ? document['@type'][0]
        : document?.['@type'];
    }),
  );
  for (const type of homepageTypes) {
    if (!pageTypes.has(type)) {
      problems.push(`${page.name}: schema ${type} tidak ditemukan.`);
    }
  }
}

const business = byType('MovingCompany');
if (business) {
  for (const field of [
    'name',
    'url',
    'telephone',
    'priceRange',
    'image',
    'address',
    'geo',
  ]) {
    if (!business[field]) problems.push(`MovingCompany.${field} wajib diisi.`);
  }
  const priceRange = String(business.priceRange ?? '');
  if (!priceRange.includes('6.500')) {
    problems.push('MovingCompany.priceRange harus memuat tarif Rp 6.500/km.');
  }
  if (!priceRange.includes('50.000')) {
    problems.push('MovingCompany.priceRange harus memuat jasa sopir tetap Rp 50.000.');
  }
  if (!priceRange.includes('65.000')) {
    problems.push('MovingCompany.priceRange harus memuat bantuan sopir Rp 65.000.');
  }
  if (/jasa sopir Rp 65\.000/.test(priceRange)) {
    problems.push(
      'MovingCompany.priceRange salah menyebut Rp 65.000 sebagai jasa sopir; angka itu adalah bantuan sopir.',
    );
  }
  if (
    !Array.isArray(business.openingHoursSpecification) ||
    business.openingHoursSpecification.length === 0
  ) {
    problems.push('MovingCompany.openingHoursSpecification wajib berisi jam buka.');
  }
  if (
    typeof business.geo?.latitude !== 'number' ||
    typeof business.geo?.longitude !== 'number'
  ) {
    problems.push('MovingCompany.geo harus berisi latitude dan longitude numerik.');
  }
  if (!business.address?.streetAddress || !business.address?.addressLocality) {
    problems.push('MovingCompany.address harus berisi streetAddress dan addressLocality.');
  }
  if (business.aggregateRating || business.review) {
    problems.push(
      'MovingCompany tidak boleh memuat aggregateRating/review tanpa ulasan nyata.',
    );
  }
}

const metaContent = (html, selector) => {
  const match = html.match(selector);
  return match?.[1]?.replace(/&amp;/g, '&')?.trim() ?? null;
};

const seen = {
  title: new Map(),
  description: new Map(),
  canonical: new Map(),
  ogTitle: new Map(),
  ogDescription: new Map(),
  twitterTitle: new Map(),
  twitterDescription: new Map(),
};

const recordUnique = (field, name, value) => {
  if (!value) return;
  const previous = seen[field].get(value);
  if (previous) {
    problems.push(`${name}: ${field} sama dengan ${previous} (${value}).`);
  } else {
    seen[field].set(value, name);
  }
};

for (const page of pageDefinitions) {
  const source = sources[page.name];
  const expectedUrl = `${BASE}${page.path}`;
  const title = metaContent(source, /<title>([\s\S]*?)<\/title>/i);
  const description = metaContent(
    source,
    /<meta\s+name="description"\s+content="([^"]*)"/i,
  );
  const canonical = metaContent(
    source,
    /<link\s+rel="canonical"\s+href="([^"]+)"/i,
  );
  const robots = metaContent(
    source,
    /<meta\s+name="robots"\s+content="([^"]*)"/i,
  );
  const hreflangId = metaContent(
    source,
    /<link\s+rel="alternate"\s+hreflang="id"\s+href="([^"]+)"/i,
  );
  const hreflangDefault = metaContent(
    source,
    /<link\s+rel="alternate"\s+hreflang="x-default"\s+href="([^"]+)"/i,
  );

  if (!title || !title.includes('Jasa Angkut Slamet')) {
    problems.push(`${page.name}: title harus menyebut "Jasa Angkut Slamet".`);
  }
  for (const part of page.titleParts) {
    if (!title?.includes(part)) {
      problems.push(`${page.name}: title harus memuat "${part}".`);
    }
  }
  if (!description || description.length < 70) {
    problems.push(`${page.name}: meta description kurang informatif.`);
  }
  for (const part of page.descriptionParts ?? []) {
    if (!description?.includes(part)) {
      problems.push(`${page.name}: meta description harus memuat "${part}".`);
    }
  }
  if (canonical !== expectedUrl) {
    problems.push(`${page.name}: canonical harus ${expectedUrl}, ditemukan ${canonical}.`);
  }
  if (hreflangId !== expectedUrl || hreflangDefault !== expectedUrl) {
    problems.push(`${page.name}: hreflang id dan x-default harus sama dengan canonical.`);
  }
  if (!/index,\s*follow/i.test(robots ?? '')) {
    problems.push(`${page.name}: robots harus mengizinkan index,follow.`);
  }
  if (/<meta\s+name="keywords"/i.test(source)) {
    problems.push(`${page.name}: meta keywords tidak dipakai oleh Google dan harus dihapus.`);
  }
  if (/\[GUNAKAN URL GAMBAR ASLI|example\.com|placeholder/i.test(source)) {
    problems.push(`${page.name}: masih ada placeholder URL/teks.`);
  }

  const requiredMeta = [
    ['og:type', /<meta\s+property="og:type"/i],
    ['og:site_name', /<meta\s+property="og:site_name"/i],
    ['og:title', /<meta\s+property="og:title"/i],
    ['og:description', /<meta\s+property="og:description"/i],
    ['og:url', /<meta\s+property="og:url"/i],
    ['og:locale', /<meta\s+property="og:locale"\s+content="id_ID"/i],
    ['og:image', /<meta\s+property="og:image"/i],
    ['twitter:card', /<meta\s+name="twitter:card"\s+content="summary_large_image"/i],
    ['twitter:url', /<meta\s+name="twitter:url"/i],
    ['twitter:title', /<meta\s+name="twitter:title"/i],
    ['twitter:description', /<meta\s+name="twitter:description"/i],
    ['twitter:image', /<meta\s+name="twitter:image"/i],
  ];
  for (const [label, pattern] of requiredMeta) {
    if (!pattern.test(source)) problems.push(`${page.name}: ${label} wajib diisi.`);
  }

  const ogUrl = metaContent(source, /<meta\s+property="og:url"\s+content="([^"]+)"/i);
  const twitterUrl = metaContent(source, /<meta\s+name="twitter:url"\s+content="([^"]+)"/i);
  if (ogUrl !== expectedUrl) problems.push(`${page.name}: og:url harus ${expectedUrl}.`);
  if (twitterUrl !== expectedUrl) problems.push(`${page.name}: twitter:url harus ${expectedUrl}.`);

  recordUnique('title', page.name, title);
  recordUnique('description', page.name, description);
  recordUnique('canonical', page.name, canonical);
  recordUnique(
    'ogTitle',
    page.name,
    metaContent(source, /<meta\s+property="og:title"\s+content="([^"]*)"/i),
  );
  recordUnique(
    'ogDescription',
    page.name,
    metaContent(source, /<meta\s+property="og:description"\s+content="([^"]*)"/i),
  );
  recordUnique(
    'twitterTitle',
    page.name,
    metaContent(source, /<meta\s+name="twitter:title"\s+content="([^"]*)"/i),
  );
  recordUnique(
    'twitterDescription',
    page.name,
    metaContent(source, /<meta\s+name="twitter:description"\s+content="([^"]*)"/i),
  );

  for (const image of [
    metaContent(source, /<meta\s+property="og:image"\s+content="([^"]+)"/i),
    metaContent(source, /<meta\s+name="twitter:image"\s+content="([^"]+)"/i),
  ]) {
    if (!image?.startsWith(`${BASE}/`)) {
      problems.push(`${page.name}: og:image/twitter:image harus memakai URL aset resmi.`);
      continue;
    }
    try {
      await access(new URL(`../public${new URL(image).pathname}`, import.meta.url));
    } catch {
      problems.push(`${page.name}: gambar sosial tidak ditemukan di public: ${image}`);
    }
  }
}

const faq = byType('FAQPage');
if (faq) {
  if (!Array.isArray(faq.mainEntity) || faq.mainEntity.length === 0) {
    problems.push('FAQPage.mainEntity wajib berisi pertanyaan.');
  } else {
    faq.mainEntity.forEach((entry, index) => {
      if (!entry.name) problems.push(`FAQPage.mainEntity[${index}].name kosong.`);
      if (!entry.acceptedAnswer?.text) {
        problems.push(`FAQPage.mainEntity[${index}].acceptedAnswer.text kosong.`);
      }
    });
  }
}

const gallery = byType('ImageGallery');
if (gallery) {
  const images = gallery.associatedMedia ?? gallery.image ?? [];
  if (!Array.isArray(images) || images.length === 0) {
    problems.push('ImageGallery wajib memuat gambar.');
  } else {
    images.forEach((image, index) => {
      if (!image.contentUrl) problems.push(`ImageGallery[${index}].contentUrl kosong.`);
      if (!image.width || !image.height) {
        problems.push(`ImageGallery[${index}] harus memuat width dan height.`);
      }
    });
  }
}

const service = byType('Service');
if (service && !service.provider) {
  problems.push('Service.provider wajib diisi.');
}

const breadcrumb = byType('BreadcrumbList');
if (breadcrumb) {
  const items = breadcrumb.itemListElement ?? [];
  if (!Array.isArray(items) || items.length < 2) {
    problems.push('BreadcrumbList wajib memuat minimal dua level.');
  }
  if (!/<nav class="breadcrumb" aria-label="Breadcrumb">/.test(sources['privasi.html'])) {
    problems.push('BreadcrumbList harus memiliki breadcrumb yang terlihat di privasi.html.');
  }
}

if (!/Sitemap:\s*https:\/\/jasa-angkut-slamet\.vercel\.app\/sitemap\.xml/i.test(sources.robots)) {
  problems.push('robots.txt harus mencantumkan sitemap HTTPS absolut.');
}
if (/Disallow:\s*\/\s*$/mi.test(sources.robots)) {
  problems.push('robots.txt tidak boleh memblokir seluruh situs.');
}

let vercelConfig = null;
try {
  vercelConfig = JSON.parse(sources.vercel);
} catch (error) {
  problems.push(`vercel.json bukan JSON valid: ${error.message}`);
}
if (vercelConfig?.cleanUrls !== true) {
  problems.push('vercel.json harus mengaktifkan cleanUrls agar .html dilayani tanpa ekstensi.');
}
if (vercelConfig?.trailingSlash !== false) {
  problems.push('vercel.json harus memakai trailingSlash: false agar URL tidak berakhir dengan /.');
}

const sitemapLocs = [
  ...sources.sitemap.matchAll(/<loc>([^<]+)<\/loc>/g),
].map((match) => match[1]);
if (sitemapLocs.length === 0) {
  problems.push('sitemap.xml tidak memuat URL.');
}
if (new Set(sitemapLocs).size !== sitemapLocs.length) {
  problems.push('sitemap.xml memuat URL ganda.');
}
for (const loc of sitemapLocs) {
  if (!loc.startsWith(`${BASE}/`)) {
    problems.push(`sitemap.xml memuat URL non-kanonik: ${loc}`);
  }
}
for (const page of pageDefinitions) {
  const url = `${BASE}${page.path}`;
  if (!sitemapLocs.includes(url)) {
    problems.push(`sitemap.xml belum memuat canonical ${url}`);
  }
}
for (const loc of sitemapLocs) {
  if (!seen.canonical.has(loc)) {
    problems.push(`sitemap.xml memuat URL tanpa canonical yang cocok: ${loc}`);
  }
}

if (problems.length > 0) {
  console.error('Validasi SEO gagal:');
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log(
    `Validasi SEO OK: ${pageDefinitions.length} halaman, ${blocks.length} blok JSON-LD (${flatTypes.join(', ')}), metadata unik, sitemap, dan robots.`,
  );
}
