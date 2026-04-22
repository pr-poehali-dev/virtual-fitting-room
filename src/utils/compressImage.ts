export interface CompressOptions {
  maxSize?: number;
  maxBytes?: number;
  quality?: number;
}

const DEFAULTS: Required<CompressOptions> = {
  maxSize: 1600,
  maxBytes: 1.5 * 1024 * 1024,
  quality: 0.85,
};

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mime, quality);
  });
}

export async function compressImage(file: File, options: CompressOptions = {}): Promise<File> {
  const opts = { ...DEFAULTS, ...options };

  if (!file.type.startsWith('image/')) return file;
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file;

  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    return file;
  }

  const longSide = Math.max(img.width, img.height);
  const needsResize = longSide > opts.maxSize;
  const needsCompress = file.size > opts.maxBytes;

  if (!needsResize && !needsCompress) return file;

  const scale = needsResize ? opts.maxSize / longSide : 1;
  const targetW = Math.round(img.width * scale);
  const targetH = Math.round(img.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;

  const isPng = file.type === 'image/png';
  const outMime = isPng ? 'image/png' : 'image/jpeg';

  if (!isPng) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);
  }
  ctx.drawImage(img, 0, 0, targetW, targetH);

  const blob = await canvasToBlob(canvas, outMime, opts.quality);
  if (!blob) return file;

  if (blob.size >= file.size) return file;

  const ext = isPng ? 'png' : 'jpg';
  const baseName = file.name.replace(/\.[^.]+$/, '');
  return new File([blob], `${baseName}.${ext}`, { type: outMime, lastModified: Date.now() });
}

function dataUrlSize(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  if (comma === -1) return dataUrl.length;
  const base64 = dataUrl.slice(comma + 1);
  const padding = (base64.match(/=+$/) || [''])[0].length;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function loadImageFromSrc(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

export async function compressDataUrl(dataUrl: string, options: CompressOptions = {}): Promise<string> {
  const opts = { ...DEFAULTS, ...options };
  if (!dataUrl.startsWith('data:image/')) return dataUrl;

  const isPng = dataUrl.startsWith('data:image/png');
  const origSize = dataUrlSize(dataUrl);

  let img: HTMLImageElement;
  try {
    img = await loadImageFromSrc(dataUrl);
  } catch {
    return dataUrl;
  }

  const longSide = Math.max(img.width, img.height);
  const needsResize = longSide > opts.maxSize;
  const needsCompress = origSize > opts.maxBytes;
  if (!needsResize && !needsCompress) return dataUrl;

  const scale = needsResize ? opts.maxSize / longSide : 1;
  const targetW = Math.round(img.width * scale);
  const targetH = Math.round(img.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;

  const outMime = isPng ? 'image/png' : 'image/jpeg';
  if (!isPng) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);
  }
  ctx.drawImage(img, 0, 0, targetW, targetH);

  const out = canvas.toDataURL(outMime, opts.quality);
  if (dataUrlSize(out) >= origSize) return dataUrl;
  return out;
}

export default compressImage;