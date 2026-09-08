"use client";

import { useRef, useState } from "react";
import Image from "next/image";

interface ImagePickerProps {
  images: string[];
  onChange: (images: string[]) => void;
}

export function ImagePicker({ images, onChange }: ImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    setUploading(true);

    const uploaded: string[] = [];
    for (const file of Array.from(fileList)) {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't upload that image.");
        continue;
      }
      uploaded.push(data.url as string);
    }

    setUploading(false);
    if (uploaded.length) onChange([...images, ...uploaded]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeImage(url: string) {
    onChange(images.filter((img) => img !== url));
  }

  return (
    <div className="flex flex-col gap-2 font-body text-sm">
      <span className="font-tag text-[0.65rem] uppercase tracking-widest text-ink/60">Photos</span>

      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((url) => (
            <div key={url} className="group relative aspect-square overflow-hidden rounded-lg border border-canvas-line">
              <Image src={url} alt="" fill sizes="120px" className="object-cover" />
              <button
                type="button"
                onClick={() => removeImage(url)}
                aria-label="Remove photo"
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-xs font-bold text-canvas transition-standard hover:bg-brick"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="transition-standard w-fit rounded-full border border-pine px-4 py-2 font-tag text-xs uppercase tracking-wide text-pine hover:bg-pine hover:text-canvas disabled:opacity-50"
      >
        {uploading ? "Uploading…" : "Choose photos from this device"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />

      {error && (
        <p role="alert" className="font-body text-sm text-brick">
          {error}
        </p>
      )}
    </div>
  );
}
