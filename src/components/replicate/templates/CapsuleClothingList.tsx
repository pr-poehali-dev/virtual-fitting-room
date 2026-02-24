import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";
import CapsuleClothingSlot from "./CapsuleClothingSlot";
import type { TemplateGarment } from "./ClothingMultiSelect";

interface CapsuleClothingListProps {
  garments: TemplateGarment[];
  onUpdate: (id: string, updates: Partial<TemplateGarment>) => void;
  onRemove: (id: string) => void;
  onImageUpload: (id: string, file: File) => void;
  onAddWithPhoto: () => void;
  onAddTextOnly: () => void;
  disabled?: boolean;
}

export default function CapsuleClothingList({
  garments,
  onUpdate,
  onRemove,
  onImageUpload,
  onAddWithPhoto,
  onAddTextOnly,
  disabled,
}: CapsuleClothingListProps) {
  const photoCount = garments.filter((g) => !g.textOnly).length;
  const textCount = garments.filter((g) => g.textOnly).length;
  const canAddPhoto = photoCount < 10;
  const canAddText = textCount < 5;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold">
          <Icon name="Shirt" className="inline mr-1.5" size={16} />
          Одежда ({garments.length}/15)
        </p>
        <div className="flex gap-1.5">
          {canAddPhoto && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAddWithPhoto}
              disabled={disabled}
              className="h-7 text-xs"
            >
              <Icon name="ImagePlus" size={12} className="mr-1" />
              + Фото
            </Button>
          )}
          {canAddText && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAddTextOnly}
              disabled={disabled}
              className="h-7 text-xs"
            >
              <Icon name="Type" size={12} className="mr-1" />
              + Описание
            </Button>
          )}
        </div>
      </div>

      {garments.length === 0 ? (
        <div className="text-center py-6 border-2 border-dashed rounded-lg text-sm text-muted-foreground">
          Добавьте предметы одежды
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {garments.map((garment, index) => (
            <CapsuleClothingSlot
              key={garment.id}
              garment={garment}
              index={index}
              onUpdate={onUpdate}
              onRemove={onRemove}
              onImageUpload={onImageUpload}
              disabled={disabled}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-2">
        До 10 фото + до 5 описаний текстом
      </p>
    </div>
  );
}