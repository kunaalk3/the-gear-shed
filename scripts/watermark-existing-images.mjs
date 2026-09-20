import { neon } from "@neondatabase/serverless";
import { put } from "@vercel/blob";
import sharp from "sharp";
import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

const dbUrl = process.env.DATABASE_URL;
const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
if (!dbUrl) {
  console.error("DATABASE_URL missing from .env.local");
  process.exit(1);
}
if (!blobToken) {
  console.error("BLOB_READ_WRITE_TOKEN missing from .env.local");
  process.exit(1);
}

const sql = neon(dbUrl);

const WATERMARK_TEXT = "ComRes";

function buildWatermarkSvg(width, height) {
  const tileSize = 200;
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="watermark" width="${tileSize}" height="${tileSize}" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
          <text x="0" y="${tileSize / 2}" font-family="sans-serif" font-size="28" font-weight="700"
                fill="rgba(255,255,255,0.32)" stroke="rgba(0,0,0,0.18)" stroke-width="0.5">
            ${WATERMARK_TEXT}
          </text>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#watermark)" />
    </svg>
  `);
}

async function watermarkImage(buffer) {
  const image = sharp(buffer);
  const { width, height } = await image.metadata();
  if (!width || !height) return buffer;
  const overlay = buildWatermarkSvg(width, height);
  return image.composite([{ input: overlay, blend: "over" }]).jpeg({ quality: 88 }).toBuffer();
}

// Skip anything already served from our own Blob store — only picsum.photos
// seed placeholders (and similar external stock URLs) still need watermarking.
function needsWatermark(url) {
  return !url.includes(".public.blob.vercel-storage.com");
}

const items = await sql`select id, name, images from equipment_items order by name`;
console.log(`Found ${items.length} items.`);

let updated = 0;
for (const item of items) {
  const images = item.images ?? [];
  if (images.length === 0 || !images.some(needsWatermark)) continue;

  const newImages = [];
  for (const url of images) {
    if (!needsWatermark(url)) {
      newImages.push(url);
      continue;
    }
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`  skip (fetch failed ${res.status}): ${url}`);
      newImages.push(url);
      continue;
    }
    const original = Buffer.from(await res.arrayBuffer());
    const watermarked = await watermarkImage(original);
    const filename = `${randomUUID()}.jpg`;
    const blob = await put(`uploads/${filename}`, watermarked, {
      access: "public",
      contentType: "image/jpeg",
    });
    newImages.push(blob.url);
  }

  await sql`update equipment_items set images = ${newImages} where id = ${item.id}`;
  updated += 1;
  console.log(`  watermarked: ${item.name} (${item.id})`);
}

console.log(`Done. Updated ${updated} of ${items.length} items.`);
