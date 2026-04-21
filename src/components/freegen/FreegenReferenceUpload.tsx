import { useRef } from 'react';
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

const MAX_FILE_SIZE_MB = 10;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function FreegenReferenceUpload({
  references,
  onChange,
  onInsertLabel,
  max,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = max - references.length;
    if (remaining <= 0) {
      toast.error(`Максимум ${max} референсов`);
      return;
    }
    const arr = Array.from(files).slice(0, remaining);
    const newRefs: string[] = [];
    for (const f of arr) {
      if (!f.type.startsWith('image/')) {
        toast.error(`${f.name}: не изображение`);
        continue;
      }
      if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast.error(`${f.name}: больше ${MAX_FILE_SIZE_MB} МБ`);
        continue;
      }
      try {
        const dataUrl = await fileToDataUrl(f);
        newRefs.push(dataUrl);
      } catch {
        toast.error(`${f.name}: ошибка чтения`);
      }
    }
    if (newRefs.length > 0) {
      onChange([...references, ...newRefs]);
    }
  };

  const removeRef = (index: number) => {
    onChange(references.filter((_, i) => i !== index));
  };

  return (
    <div>
      <Label className="mb-2 block">
        Референсы ({references.length}/{max})
      </Label>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        disabled={disabled}
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

        {references.length < max && !disabled && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="aspect-square rounded-lg border border-dashed flex flex-col items-center justify-center gap-1 hover:bg-muted transition-colors text-muted-foreground"
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
