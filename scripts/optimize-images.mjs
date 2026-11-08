import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const publicDir = new URL("../public/", import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  "$1",
);

const galleryPattern = /^galeri-.*-(480|800|1200)\.jpg$/;

async function isFresh(source, output) {
  const [sourceStat, outputStat] = await Promise.all([
    stat(source),
    stat(output).catch(() => null),
  ]);
  return Boolean(outputStat && outputStat.mtimeMs >= sourceStat.mtimeMs);
}

async function run() {
  const files = (await readdir(publicDir))
    .filter((file) => galleryPattern.test(file))
    .sort();

  let before = 0;
  let after = 0;
  let skipped = 0;

  for (const file of files) {
    const source = join(publicDir, file);
    const base = source.slice(0, -4);
    const sourceStat = await stat(source);
    before += sourceStat.size;

    for (const format of ["webp", "avif"]) {
      const output = `${base}.${format}`;
      if (await isFresh(source, output)) {
        skipped += 1;
      } else {
        const image = sharp(source);
        if (format === "webp") {
          await image.webp({ quality: 78, effort: 4 }).toFile(output);
        } else {
          await image.avif({ quality: 55, effort: 5 }).toFile(output);
        }
        console.log(`created ${output.split(/[\\/]/).pop()}`);
      }
      after += (await stat(output)).size;
    }
  }

  const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  console.log(
    `\n${files.length} JPG (${mb(before)}) -> ${files.length * 2} modern variants (${mb(after)}), ${skipped} up to date.`,
  );
  console.log("JPG fallbacks are kept for older browsers and social previews.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
