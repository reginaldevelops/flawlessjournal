/**
 * Compress an image Blob/File to a JPEG data URL suitable for trades.data.
 * Keeps charts usable without Supabase Storage.
 */

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.78;
const MAX_OUTPUT_CHARS = 1_800_000; // ~1.8MB string ceiling

export function isProbablyUrl(value) {
  const s = String(value ?? "").trim();
  return /^https?:\/\//i.test(s) || s.startsWith("data:image/");
}

export function isImageDataUrl(value) {
  return String(value ?? "").startsWith("data:image/");
}

/**
 * @param {Blob|File} blob
 * @returns {Promise<string>} data URL
 */
export async function compressImageToDataUrl(blob) {
  if (!blob || !blob.type?.startsWith("image/")) {
    throw new Error("Not an image");
  }

  const bitmap = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(bitmap, 0, 0, w, h);

    let quality = JPEG_QUALITY;
    let dataUrl = canvas.toDataURL("image/jpeg", quality);
    while (dataUrl.length > MAX_OUTPUT_CHARS && quality > 0.4) {
      quality -= 0.1;
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }
    if (dataUrl.length > MAX_OUTPUT_CHARS) {
      throw new Error("Image is too large even after compression");
    }
    return dataUrl;
  } finally {
    bitmap.close?.();
  }
}

/**
 * Read clipboard/drag payload: prefer image file, else plain URL text.
 * @returns {Promise<{ kind: 'image'|'url', value: string }|null>}
 */
export async function readChartPaste(event) {
  const clipboard = event?.clipboardData || event?.dataTransfer;
  if (!clipboard) return null;

  const files = [...(clipboard.files || [])];
  const imageFile = files.find((f) => f.type.startsWith("image/"));
  if (imageFile) {
    const value = await compressImageToDataUrl(imageFile);
    return { kind: "image", value };
  }

  // Some apps put the image in items without Files
  const items = [...(clipboard.items || [])];
  for (const item of items) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) {
        const value = await compressImageToDataUrl(file);
        return { kind: "image", value };
      }
    }
  }

  const text = String(clipboard.getData?.("text") || "").trim();
  if (text && isProbablyUrl(text)) {
    return { kind: "url", value: text };
  }

  return null;
}
