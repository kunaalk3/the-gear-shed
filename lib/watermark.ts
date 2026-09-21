import sharp from "sharp";
import { WATERMARK_TILE_PNG_BASE64 } from "@/lib/watermark-tile";

const TILE_SIZE = 200;

/**
 * Builds a tiled diagonal "ComRes" pattern from a pre-rendered PNG tile
 * (see lib/watermark-tile.ts) rather than SVG <text>. Vercel's serverless
 * runtime has no system fonts, so librsvg silently rendered the text as
 * empty glyph boxes there even though the same SVG worked fine locally —
 * baking the text into a raster tile removes that font dependency entirely.
 */
function buildWatermarkSvg(width: number, height: number): Buffer {
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="watermark" width="${TILE_SIZE}" height="${TILE_SIZE}" patternUnits="userSpaceOnUse">
          <image href="data:image/png;base64,${WATERMARK_TILE_PNG_BASE64}" x="0" y="0" width="${TILE_SIZE}" height="${TILE_SIZE}" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#watermark)" />
    </svg>
  `;
  return Buffer.from(svg);
}

const FORMAT_BY_TYPE: Record<string, "jpeg" | "png" | "webp" | "gif"> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Composites the ComRes watermark over an uploaded image, preserving its original format. */
export async function watermarkImage(buffer: Buffer, contentType: string): Promise<Buffer> {
  const format = FORMAT_BY_TYPE[contentType];
  if (!format) return buffer;

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
  }
}
