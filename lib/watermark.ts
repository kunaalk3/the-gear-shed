import sharp from "sharp";

const WATERMARK_TEXT = "ComRes";

/** Builds a tiled, diagonal watermark pattern sized to the source image so it survives crops and screenshots alike. */
function buildWatermarkSvg(width: number, height: number): Buffer {
  const tileSize = 200;
  const svg = `
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
