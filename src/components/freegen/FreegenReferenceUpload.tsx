import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';

interface Props {
  references: string[];
  onChange: (refs: string[]) => void;
  onInsertLabel: (index: number) => void;
  max: number;
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
  // PNG с прозрачностью не трогаем, если он маленький — иначе тоже сжимаем в JPEG
  const needsAlpha = file.type === 'image/png' && file.size < 1.5 * 1024 * 1024;
  if (needsAlpha) {
    return fileToDataUrl(file);
  }

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
  if (!data.url) throw new Error('Empty URL from server');
  return data.url as string;
}

export default function FreegenReferenceUpload({
  references,
  onChange,
  onInsertLabel,
  max,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadingCount, setUploadingCount] = useState(0);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = max - references.length;
    if (remaining <= 0) {
      toast.error(`Максимум ${max} референсов`);
      return;
    }
    const arr = Array.from(files).slice(0, remaining);

    const validFiles: File[] = [];
    for (const f of arr) {
      if (!f.type.startsWith('image/')) {
        toast.error(`${f.name}: не изображение`);
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

    const uploadPromises = validFiles.map(async (f) => {
      try {
        const dataUrl = await compressImage(f);
        const url = await uploadToS3(dataUrl);
        return url;
      } catch (e) {
        toast.error(`${f.name}: ${e instanceof Error ? e.message : 'ошибка загрузки'}`);
        return null;
      }
    });

    const results = await Promise.all(uploadPromises);
    const urls = results.filter((u): u is string => !!u);

    setUploadingCount((c) => Math.max(0, c - validFiles.length));

    if (urls.length > 0) {
      onChange([...references, ...urls]);
    }
  };

  const removeRef = (index: number) => {
    onChange(references.filter((_, i) => i !== index));
  };

  const isUploading = uploadingCount > 0;

  return (
    <div>
      <Label className="mb-2 block">
        Референсы ({references.length}/{max})
        {isUploading && (
          <span className="ml-2 text-xs text-muted-foreground">
            загрузка {uploadingCount}…
          </span>
        )}
      </Label>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        disabled={disabled || isUploading}
        onChange={(e) => {
          handleFiles(e.target.files);
          if (inputRef.current) inputRef.current.value = '';
        }}
      />

      <div className="grid grid-cols-4 gap-2">
        {references.map((ref, i) => (
          <div
            key={i}
            className="relative aspect-square rounded-lg border overflow-hidden group bg-muted"
          >
            <img src={ref} alt={`ref${i + 1}`} className="w-full h-full object-cover" />
            <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-xs font-semibold">
              @ref{i + 1}
            </div>
            {!disabled && (
              <>
                <button
                  type="button"
                  onClick={() => removeRef(i)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Удалить"
                >
                  <Icon name="X" size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => onInsertLabel(i)}
                  className="absolute bottom-0 left-0 right-0 py-1 text-xs bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Вставить @ref{i + 1}
                </button>
              </>
            )}
          </div>
        ))}

        {isUploading && Array.from({ length: uploadingCount }).map((_, i) => (
          <div
            key={`uploading-${i}`}
            className="relative aspect-square rounded-lg border overflow-hidden bg-muted flex items-center justify-center"
          >
            <Icon name="Loader2" size={24} className="animate-spin text-muted-foreground" />
          </div>
        ))}

        {references.length + uploadingCount < max && !disabled && (
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

      {references.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {references.map((_, i) => (
            <Button
              key={i}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={disabled}
              onClick={() => onInsertLabel(i)}
            >
              + @ref{i + 1}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}