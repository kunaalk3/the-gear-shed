import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { randomUUID } from "crypto";
import { requireAdmin, requireOrg } from "@/lib/auth";
import { watermarkImage } from "@/lib/watermark";

const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const auth = admin.ok ? admin : await requireOrg();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: "Image storage is not configured. Set BLOB_READ_WRITE_TOKEN for local development." },
        { status: 503 }
      );
    }

    const formData = await request.formData().catch(() => null);
    const file = formData?.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
    }
    if (!Object.prototype.hasOwnProperty.call(ALLOWED_TYPES, file.type)) {
      return NextResponse.json({ error: "Only JPG, PNG, WEBP or GIF images are allowed." }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "Images must be smaller than 8MB." }, { status: 400 });
    }

    const extension = ALLOWED_TYPES[file.type];
    const filename = `${randomUUID()}.${extension}`;

    let watermarked: Buffer;
    try {
      const original = Buffer.from(await file.arrayBuffer());
      watermarked = await watermarkImage(original, file.type);
    } catch {
      return NextResponse.json({ error: "The uploaded image could not be processed." }, { status: 400 });
    }

    try {
      const blob = await put(`uploads/${filename}`, watermarked, {
        access: "public",
        contentType: file.type,
      });

      return NextResponse.json({ url: blob.url }, { status: 201 });
    } catch {
      return NextResponse.json(
        { error: "Image storage could not save this upload. Check the local Blob storage configuration and retry." },
        { status: 502 }
      );
    }
  } catch {
    return NextResponse.json({ error: "The upload request could not be completed." }, { status: 500 });
  }
}
