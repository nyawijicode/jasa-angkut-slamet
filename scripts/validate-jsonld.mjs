import { readFile } from "node:fs/promises";

const indexPath = new URL("../index.html", import.meta.url);

const html = await readFile(indexPath, "utf8");
const blocks = [
  ...html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  ),
].map((match) => match[1]);

const problems = [];

if (blocks.length === 0) {
  problems.push("index.html tidak memuat blok JSON-LD.");
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
  Array.isArray(document?.["@type"])
    ? document["@type"]
    : document?.["@type"]
      ? [document["@type"]]
      : [],
);

const byType = (type) =>
  documents.find((document) =>
    Array.isArray(document?.["@type"])
      ? document["@type"].includes(type)
      : document?.["@type"] === type,
  );

const requiredTypes = [
  "MovingCompany",
  "WebSite",
  "Service",
  "BreadcrumbList",
  "FAQPage",
  "ImageGallery",
];

for (const type of requiredTypes) {
  if (!flatTypes.includes(type)) {
    problems.push(`Structured data "${type}" tidak ditemukan.`);
  }
}

const business = byType("MovingCompany");
if (business) {
  for (const field of ["name", "url", "telephone", "priceRange", "image", "address", "geo"]) {
    if (!business[field]) problems.push(`MovingCompany.${field} wajib diisi.`);
  }
  if (!String(business.priceRange ?? "").includes("6.500")) {
    problems.push("MovingCompany.priceRange harus memuat tarif Rp 6.500/km.");
  }
  if (!String(business.priceRange ?? "").includes("50.000")) {
    problems.push("MovingCompany.priceRange harus memuat setoran Rp 50.000.");
  }
  if (!Array.isArray(business.openingHoursSpecification) || business.openingHoursSpecification.length === 0) {
    problems.push("MovingCompany.openingHoursSpecification wajib berisi jam buka.");
  }
  if (typeof business.geo?.latitude !== "number" || typeof business.geo?.longitude !== "number") {
    problems.push("MovingCompany.geo harus berisi latitude dan longitude numerik.");
  }
  if (!business.address?.streetAddress || !business.address?.addressLocality) {
    problems.push("MovingCompany.address harus berisi streetAddress dan addressLocality.");
  }
  if (business.aggregateRating || business.review) {
    problems.push(
      "MovingCompany tidak boleh memuat aggregateRating/review tanpa ulasan nyata.",
    );
  }
}

const faq = byType("FAQPage");
if (faq) {
  if (!Array.isArray(faq.mainEntity) || faq.mainEntity.length === 0) {
    problems.push("FAQPage.mainEntity wajib berisi pertanyaan.");
  } else {
    faq.mainEntity.forEach((entry, index) => {
      if (!entry.name) problems.push(`FAQPage.mainEntity[${index}].name kosong.`);
      if (!entry.acceptedAnswer?.text) {
        problems.push(`FAQPage.mainEntity[${index}].acceptedAnswer.text kosong.`);
      }
    });
  }
}

const gallery = byType("ImageGallery");
if (gallery) {
  const images = gallery.associatedMedia ?? gallery.image ?? [];
  if (!Array.isArray(images) || images.length === 0) {
    problems.push("ImageGallery wajib memuat gambar.");
  } else {
    images.forEach((image, index) => {
      if (!image.contentUrl) problems.push(`ImageGallery[${index}].contentUrl kosong.`);
      if (!image.width || !image.height) {
        problems.push(`ImageGallery[${index}] harus memuat width dan height.`);
      }
    });
  }
}

const service = byType("Service");
if (service && !service.provider) {
  problems.push("Service.provider wajib diisi.");
}

if (problems.length > 0) {
  console.error("Validasi structured data gagal:");
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log(
    `Structured data OK: ${blocks.length} blok (${flatTypes.join(", ")}).`,
  );
}
