import { access, readFile } from 'node:fs/promises';

const paths = {
  index: new URL('../index.html', import.meta.url),
  privacy: new URL('../public/privasi.html', import.meta.url),
  sitemap: new URL('../public/sitemap.xml', import.meta.url),
  robots: new URL('../public/robots.txt', import.meta.url),
};

const sources = {};
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

const blocks = [
  ...extractBlocks(sources.index),
  ...extractBlocks(sources.privacy),
];

if (blocks.length === 0) {
  problems.push('Tidak ada blok JSON-LD pada index.html maupun privasi.html.');
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

for (const [name, source] of [
  ['index.html', sources.index],
  ['privasi.html', sources.privacy],
]) {
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

  if (!title || !title.includes('Jasa Angkut Slamet')) {
    problems.push(`${name}: title harus menyebut "Jasa Angkut Slamet".`);
  }
  if (!description || description.length < 70) {
    problems.push(`${name}: meta description kurang informatif.`);
  }
  if (name === 'index.html') {
    if (!title.includes('Demak') || !title.includes('Semarang')) {
      problems.push('index.html: title harus memuat area layanan Demak dan Semarang.');
    }
    if (!description.includes('0813-2762-3942')) {
      problems.push('index.html: meta description harus memuat nomor WhatsApp.');
    }
    if (!description.includes('06.00')) {
      problems.push('index.html: meta description harus memuat jam operasional.');
    }
  }
  if (!canonical?.startsWith('https://jasa-angkut-slamet.vercel.app/')) {
    problems.push(`${name}: canonical harus berupa URL HTTPS absolut.`);
  }
  if (!/index,\s*follow/i.test(robots ?? '')) {
    problems.push(`${name}: robots harus mengizinkan index,follow.`);
  }
  if (/<meta\s+name="keywords"/i.test(source)) {
    problems.push(`${name}: meta keywords tidak dipakai oleh Google dan harus dihapus.`);
  }
  if (/\[GUNAKAN URL GAMBAR ASLI|example\.com|placeholder/i.test(source)) {
    problems.push(`${name}: masih ada placeholder URL/teks.`);
  }
}

for (const [name, source] of [
  ['index.html', sources.index],
  ['privasi.html', sources.privacy],
]) {
  const requiredMeta = [
    ['og:type', /<meta\s+property="og:type"/i],
    ['og:site_name', /<meta\s+property="og:site_name"/i],
    ['og:title', /<meta\s+property="og:title"/i],
    ['og:description', /<meta\s+property="og:description"/i],
    ['og:url', /<meta\s+property="og:url"/i],
    ['og:locale', /<meta\s+property="og:locale"\s+content="id_ID"/i],
    ['og:image', /<meta\s+property="og:image"/i],
    ['twitter:card', /<meta\s+name="twitter:card"/i],
    ['twitter:title', /<meta\s+name="twitter:title"/i],
    ['twitter:description', /<meta\s+name="twitter:description"/i],
    ['twitter:image', /<meta\s+name="twitter:image"/i],
  ];
  for (const [label, pattern] of requiredMeta) {
    if (!pattern.test(source)) problems.push(`${name}: ${label} wajib diisi.`);
  }
  if (name === 'index.html') {
    if (!/<meta\s+name="twitter:card"\s+content="summary_large_image"/i.test(source)) {
      problems.push('index.html: twitter:card harus summary_large_image.');
    }
  }
  for (const image of [
    metaContent(source, /<meta\s+property="og:image"\s+content="([^"]+)"/i),
    metaContent(source, /<meta\s+name="twitter:image"\s+content="([^"]+)"/i),
  ]) {
    if (!image?.startsWith('https://jasa-angkut-slamet.vercel.app/')) {
      problems.push(`${name}: og:image/twitter:image harus memakai URL aset resmi.`);
      continue;
    }
    try {
      await access(new URL(`../public${new URL(image).pathname}`, import.meta.url));
    } catch {
      problems.push(`${name}: gambar sosial tidak ditemukan di public: ${image}`);
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
  if (!/<nav class="breadcrumb" aria-label="Breadcrumb">/.test(sources.privacy)) {
    problems.push('BreadcrumbList harus memiliki breadcrumb yang terlihat di privasi.html.');
  }
}

if (!/Sitemap:\s*https:\/\/jasa-angkut-slamet\.vercel\.app\/sitemap\.xml/i.test(sources.robots)) {
  problems.push('robots.txt harus mencantumkan sitemap HTTPS absolut.');
}
if (/Disallow:\s*\/\s*$/mi.test(sources.robots)) {
  problems.push('robots.txt tidak boleh memblokir seluruh situs.');
}

const sitemapLocs = [
  ...sources.sitemap.matchAll(/<loc>([^<]+)<\/loc>/g),
].map((match) => match[1]);
if (sitemapLocs.length === 0) {
  problems.push('sitemap.xml tidak memuat URL.');
}
for (const loc of sitemapLocs) {
  if (!loc.startsWith('https://jasa-angkut-slamet.vercel.app/')) {
    problems.push(`sitemap.xml memuat URL non-kanonik: ${loc}`);
  }
}
for (const canonicalPath of ['/', '/privasi.html']) {
  const url = `https://jasa-angkut-slamet.vercel.app${canonicalPath}`;
  if (!sitemapLocs.includes(url)) {
    problems.push(`sitemap.xml belum memuat canonical ${url}`);
  }
}

if (problems.length > 0) {
  console.error('Validasi SEO gagal:');
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log(
    `Validasi SEO OK: ${blocks.length} blok (${flatTypes.join(', ')}), metadata, sitemap, dan robots.`,
  );
}
