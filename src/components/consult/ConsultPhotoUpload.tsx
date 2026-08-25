import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';

interface Props {
  /** Заголовок блока */
  title: string;
  /** Пояснение под заголовком */
  hint: string;
  /** Загруженные ссылки на изображения */
  images: string[];
  onChange: (images: string[]) => void;
  /** Максимум изображений в блоке */
  max: number;
  /** Подпись на плитке: 'Вы' или 'Референс N' */
  badge: (index: number) => string;
  disabled?: boolean;
}

const MAX_FILE_SIZE_MB = 15;
const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.85;
const UPLOAD_API = 'https://functions.poehali.dev/7d905cd8-a395-47b3-92d8-15fa95df1ddf';

function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function compressImage(file: File): Promise<string> {
  const needsAlpha = file.type === 'image/png' && file.size < 1.5 * 1024 * 1024;
  if (needsAlpha) return fileToDataUrl(file);

  const originalUrl = await fileToDataUrl(file);
  const img = await loadImage(originalUrl);

  let { width, height } = img;
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return originalUrl;
  ctx.drawImage(img, 0, 0, width, height);

  const blob: Blob | null = await new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', JPEG_QUALITY);
  });
  if (!blob) return originalUrl;

  return fileToDataUrl(blob);
}

async function uploadToS3(dataUrl: string): Promise<string> {
  const token = localStorage.getItem('session_token');
  const res = await fetch(UPLOAD_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'X-Session-Token': token } : {}),
    },
    body: JSON.stringify({ image: dataUrl }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  if (!data.url) throw new Error('Пустой ответ сервера');
  return data.url as string;
}

/**
 * Блок загрузки фото для консультации. Используется дважды:
 * отдельно для фото автора вопроса и отдельно для референсов,
 * чтобы человеку было очевидно, где чьё изображение.
 */
export default function ConsultPhotoUpload({
  title,
  hint,
  images,
  onChange,
  max,
  badge,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadingCount, setUploadingCount] = useState(0);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = max - images.length;
    if (remaining <= 0) {
      toast.error(`Можно добавить не больше ${max}`);
      return;
    }
    const arr = Array.from(files).slice(0, remaining);

    const validFiles: File[] = [];
    for (const f of arr) {
      if (!f.type.startsWith('image/')) {
        toast.error(`${f.name}: это не изображение`);
        continue;
      }
      if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast.error(`${f.name}: больше ${MAX_FILE_SIZE_MB} МБ`);
        continue;
      }
      validFiles.push(f);
    }
    if (validFiles.length === 0) return;

    setUploadingCount((c) => c + validFiles.length);

    const results = await Promise.all(
      validFiles.map(async (f) => {
        try {
          const dataUrl = await compressImage(f);
          return await uploadToS3(dataUrl);
        } catch (e) {
          toast.error(`${f.name}: ${e instanceof Error ? e.message : 'ошибка загрузки'}`);
          return null;
        }
      }),
    );
    const urls = results.filter((u): u is string => !!u);

    setUploadingCount((c) => Math.max(0, c - validFiles.length));
    if (urls.length > 0) onChange([...images, ...urls]);
  };

  const removeImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  const isUploading = uploadingCount > 0;

  return (
    <div>
      <Label className="mb-1 block">
        {title}
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          необязательно{max > 1 ? ` · до ${max}` : ''}
        </span>
      </Label>
      <p className="mb-2 text-xs text-muted-foreground">{hint}</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={max > 1}
        className="hidden"
        disabled={disabled || isUploading}
        onChange={(e) => {
          handleFiles(e.target.files);
          if (inputRef.current) inputRef.current.value = '';
        }}
      />

      <div className="grid grid-cols-4 gap-2">
        {images.map((src, i) => (
          <div
            key={i}
            className="relative aspect-square rounded-lg border overflow-hidden group bg-muted"
          >
            <img src={src} alt={badge(i)} className="w-full h-full object-cover" />
            <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-semibold">
              {badge(i)}
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                aria-label="Удалить"
              >
                <Icon name="X" size={14} />
              </button>
            )}
          </div>
        ))}

        {isUploading &&
          Array.from({ length: uploadingCount }).map((_, i) => (
            <div
              key={`uploading-${i}`}
              className="relative aspect-square rounded-lg border overflow-hidden bg-muted flex items-center justify-center"
            >
              <Icon name="Loader2" size={24} className="animate-spin text-muted-foreground" />
            </div>
          ))}

        {images.length + uploadingCount < max && !disabled && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="aspect-square rounded-lg border border-dashed flex flex-col items-center justify-center gap-1 hover:bg-muted transition-colors text-muted-foreground disabled:opacity-50"
          >
            <Icon name="Plus" size={20} />
            <span className="text-xs">Добавить</span>
          </button>
        )}
      </div>
    </div>
  );
}
