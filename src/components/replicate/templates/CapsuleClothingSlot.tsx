import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";
import type { TemplateGarment } from "./ClothingMultiSelect";

interface CapsuleClothingSlotProps {
  garment: TemplateGarment;
  index: number;
  onUpdate: (id: string, updates: Partial<TemplateGarment>) => void;
  onRemove: (id: string) => void;
  onImageUpload: (id: string, file: File) => void;
  disabled?: boolean;
}

export default function CapsuleClothingSlot({
  garment,
  index,
  onUpdate,
  onRemove,
  onImageUpload,
  disabled,
}: CapsuleClothingSlotProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageUpload(garment.id, file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex gap-3 items-start p-3 border rounded-lg bg-white">
      <div className="flex-shrink-0">
        {garment.textOnly ? (
          <div className="flex items-center justify-center w-16 h-16 bg-purple-50 border border-purple-200 rounded-lg">
            <Icon name="Type" size={20} className="text-purple-400" />
          </div>
        ) : (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
              id={`garment-upload-${garment.id}`}
              disabled={disabled}
            />
            {garment.image ? (
              <label
                htmlFor={`garment-upload-${garment.id}`}
                className="block w-16 h-16 rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
              >
                <img
                  src={garment.image}
                  alt={garment.label || `Вещь ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </label>
            ) : (
              <label
                htmlFor={`garment-upload-${garment.id}`}
                className="flex items-center justify-center w-16 h-16 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-purple-400 transition-colors"
              >
                <Icon name="ImagePlus" size={20} className="text-gray-400" />
              </label>
            )}
          </>
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-purple-600 flex-shrink-0">
            {index + 1}.
          </span>
          <Input
            value={garment.label}
            onChange={(e) => onUpdate(garment.id, { label: e.target.value })}
            placeholder="Название / артикул"
            className="h-7 text-xs"
            disabled={disabled}
          />
        </div>
        <Input
          value={garment.hint}
          onChange={(e) => onUpdate(garment.id, { hint: e.target.value })}
          placeholder={
            garment.image
              ? "Что взять с фото? (напр: голубой тренч)"
              : "Описание (напр: белая базовая футболка)"
          }
          className="h-7 text-xs"
          disabled={disabled}
        />
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 flex-shrink-0 text-gray-400 hover:text-red-500"
        onClick={() => onRemove(garment.id)}
        disabled={disabled}
      >
        <Icon name="X" size={14} />
      </Button>
    </div>
  );
}