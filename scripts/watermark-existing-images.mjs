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

// Pre-rendered raster tile, not live SVG <text> -- Vercel's serverless runtime
// has no system fonts, so text-based SVG watermarks render as empty glyph
// boxes there even though they look fine when this script runs locally.
// Read straight out of lib/watermark-tile.ts so there's one source of truth.
const tileSrc = readFileSync(path.join(__dirname, "..", "lib", "watermark-tile.ts"), "utf8");
const WATERMARK_TILE_PNG_BASE64 = tileSrc.match(/"([A-Za-z0-9+/=]+)"/)[1];

function buildWatermarkSvg(width, height) {
  const tileSize = 200;
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="watermark" width="${tileSize}" height="${tileSize}" patternUnits="userSpaceOnUse">
          <image href="data:image/png;base64,${WATERMARK_TILE_PNG_BASE64}" x="0" y="0" width="${tileSize}" height="${tileSize}" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#watermark)" />
    </svg>
  `);
}

const FORMAT_BY_EXTENSION = { jpg: "jpeg", jpeg: "jpeg", png: "png", webp: "webp", gif: "gif" };
const CONTENT_TYPE_BY_FORMAT = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

async function watermarkImage(buffer, format) {
  const image = sharp(buffer);
  const { width, height } = await image.metadata();
  if (!width || !height) return buffer;
  const overlay = buildWatermarkSvg(width, height);
  const composed = image.composite([{ input: overlay, blend: "over" }]);
  switch (format) {
    case "jpeg":
      return composed.jpeg({ quality: 88 }).toBuffer();
    case "png":
      return composed.png().toBuffer();
    case "webp":
      return composed.webp({ quality: 88 }).toBuffer();
    case "gif":
      return composed.gif().toBuffer();
    default:
      return composed.jpeg({ quality: 88 }).toBuffer();
  }
}

// Every item from the original seed catalog (owner_id is null) was already
// watermarked correctly by the two backfill runs on 2026-09-21, run locally
// where real fonts exist. This corrective pass targets only items added
// afterwards through the org self-service "Add an item" flow (owner_id set)
// -- those went through the live /api/uploads endpoint on Vercel, which had
// no system fonts and silently baked in an unreadable "empty box" watermark
// instead of "ComRes". Re-stamping them with the fixed raster-tile watermark
// leaves the old faint boxes underneath but makes "ComRes" clearly legible.
const items = await sql`select id, name, images from equipment_items where owner_id is not null order by name`;
console.log(`Found ${items.length} org-uploaded items to re-watermark.`);

let updated = 0;
for (const item of items) {
  const images = item.images ?? [];
  if (images.length === 0) continue;

  const newImages = [];
  for (const url of images) {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`  skip (fetch failed ${res.status}): ${url}`);
      newImages.push(url);
      continue;
    }
    const original = Buffer.from(await res.arrayBuffer());
    const extMatch = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    const ext = (extMatch?.[1] ?? "jpg").toLowerCase();
    const format = FORMAT_BY_EXTENSION[ext] ?? "jpeg";
    const watermarked = await watermarkImage(original, format);
    const filename = `${randomUUID()}.${ext in FORMAT_BY_EXTENSION ? ext : "jpg"}`;
    const blob = await put(`uploads/${filename}`, watermarked, {
      access: "public",
      contentType: CONTENT_TYPE_BY_FORMAT[format],
    });
    newImages.push(blob.url);
  }

  await sql`update equipment_items set images = ${newImages} where id = ${item.id}`;
  updated += 1;
  console.log(`  watermarked: ${item.name} (${item.id})`);
}

console.log(`Done. Updated ${updated} of ${items.length} items.`);
