import { useState, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import Icon from "@/components/ui/icon";
import { Link } from "react-router-dom";
import ReplicateImageUpload from "@/components/replicate/ReplicateImageUpload";
import ReplicateResultPanel from "@/components/replicate/ReplicateResultPanel";
import ImageCropper from "@/components/ImageCropper";
import CapsuleClothingList from "./CapsuleClothingList";
import ClothingMultiSelect from "./ClothingMultiSelect";
import type { TemplateGarment } from "./ClothingMultiSelect";
import { useTemplateGeneration } from "@/hooks/useTemplateGeneration";
import { validateImageFile } from "@/utils/fileValidation";
import { GENERATION_COST, MIN_TOPUP } from "@/config/prices";

interface CapsuleTemplateProps {
  user: { id: string; email: string; unlimited_access?: boolean } | null;
  hasInsufficientBalance: boolean;
  onRefetchHistory: () => Promise<void>;
}

const TEMPLATE_IMAGE_URL =
  "https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/1d3a4b34-c272-4bbd-9a92-b24e92cb74b8.jpg";

export default function CapsuleTemplate({
  user,
  hasInsufficientBalance,
  onRefetchHistory,
}: CapsuleTemplateProps) {
  const [personImage, setPersonImage] = useState<string | null>(null);
  const [garments, setGarments] = useState<TemplateGarment[]>([]);
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [showLabels, setShowLabels] = useState(true);
  const [modelOutfit, setModelOutfit] = useState<number[]>([]);
  const [showCropper, setShowCropper] = useState(false);
  const [tempImageForCrop, setTempImageForCrop] = useState<string | null>(null);

  const {
    isGenerating,
    generationStatus,
    generatedImage,
    hasTimedOut,
    generate,
    reset,
  } = useTemplateGeneration(user, onRefetchHistory);

  const resizeImage = (
    file: File,
    maxW: number,
    maxH: number
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let w = img.width;
          let h = img.height;
          if (w > maxW || h > maxH) {
            const r = Math.min(maxW / w, maxH / h);
            w = Math.floor(w * r);
            h = Math.floor(h * r);
          }
          const c = document.createElement("canvas");
          c.width = w;
          c.height = h;
          const ctx = c.getContext("2d");
          if (!ctx) return reject(new Error("No canvas context"));
          ctx.drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL("image/jpeg", 0.9));
        };
        img.onerror = () => reject(new Error("Image load failed"));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("File read failed"));
      reader.readAsDataURL(file);
    });
  };

  const handlePersonUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateImageFile(file);
    if (!validation.isValid) {
      toast.error(validation.error || "Неверный файл");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const ratio = img.width / img.height;
        if (Math.abs(ratio - 3 / 4) < 0.05) {
          resizeImage(file, 1024, 1024).then(setPersonImage).catch(() => {
            toast.error("Ошибка обработки");
          });
        } else {
          setTempImageForCrop(event.target?.result as string);
          setShowCropper(true);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = (cropped: string) => {
    setPersonImage(cropped);
    setShowCropper(false);
    setTempImageForCrop(null);
    toast.success("Фото обрезано и загружено");
  };

  const addGarmentSlot = useCallback(
    (withPhoto: boolean) => {
      const photoCount = garments.filter((g) => g.image).length;
      const textCount = garments.filter((g) => !g.image).length;

      if (withPhoto && photoCount >= 8) {
        toast.error("Максимум 8 фото одежды");
        return;
      }
      if (!withPhoto && textCount >= 7) {
        toast.error("Максимум 7 описаний без фото");
        return;
      }

      setGarments((prev) => [
        ...prev,
        {
          id: `g-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          image: withPhoto ? undefined : undefined,
          hint: "",
          label: "",
        },
      ]);
    },
    [garments]
  );

  const updateGarment = useCallback(
    (id: string, updates: Partial<TemplateGarment>) => {
      setGarments((prev) =>
        prev.map((g) => (g.id === id ? { ...g, ...updates } : g))
      );
    },
    []
  );

  const removeGarment = useCallback(
    (id: string) => {
      setGarments((prev) => {
        const newList = prev.filter((g) => g.id !== id);
        const removedIdx = prev.findIndex((g) => g.id === id);
        if (removedIdx >= 0) {
          setModelOutfit((mo) =>
            mo
              .filter((i) => i !== removedIdx)
              .map((i) => (i > removedIdx ? i - 1 : i))
          );
        }
        return newList;
      });
    },
    []
  );

  const handleGarmentImageUpload = useCallback(
    async (id: string, file: File) => {
      const validation = validateImageFile(file);
      if (!validation.isValid) {
        toast.error(validation.error || "Неверный файл");
        return;
      }
      try {
        const resized = await resizeImage(file, 1024, 1024);
        updateGarment(id, { image: resized });
      } catch {
        toast.error("Ошибка загрузки изображения");
      }
    },
    [updateGarment]
  );

  const handleGenerate = async () => {
    if (!personImage) {
      toast.error("Загрузите фото человека");
      return;
    }
    if (garments.length === 0) {
      toast.error("Добавьте хотя бы одну вещь");
      return;
    }
    if (modelOutfit.length === 0) {
      toast.error("Выберите одежду для модели слева");
      return;
    }

    await generate({
      mode: "capsule",
      person_image: personImage,
      template_image: TEMPLATE_IMAGE_URL,
      garments: garments.map((g) => ({
        image: g.image || null,
        hint: g.hint,
        label: g.label,
      })),
      title,
      prompt,
      show_labels: showLabels,
      model_outfit: modelOutfit,
    });
  };

  const handleReset = () => {
    reset();
    setPersonImage(null);
    setGarments([]);
    setTitle("");
    setPrompt("");
    setModelOutfit([]);
  };

  const handleDownloadImage = async () => {
    if (!generatedImage) return;
    try {
      const response = await fetch(generatedImage);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `capsule-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 100);
      toast.success("Скачано!");
    } catch {
      toast.error("Ошибка скачивания");
    }
  };

  return (
    <>
      <div className="grid lg:grid-cols-2 gap-8 mb-12">
        <Card className="animate-scale-in">
          <CardContent className="p-6 space-y-5">
            {!user && (
              <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <Icon name="Info" className="text-primary mt-0.5 flex-shrink-0" size={20} />
                  <div>
                    <p className="text-sm font-medium text-primary mb-1">Требуется авторизация</p>
                    <p className="text-sm text-muted-foreground mb-2">
                      Для генерации необходимо войти и пополнить баланс минимум на {MIN_TOPUP}₽.
                    </p>
                    <div className="flex gap-2">
                      <Link to="/login"><Button size="sm">Войти</Button></Link>
                      <Link to="/register"><Button size="sm" variant="outline">Регистрация</Button></Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {hasInsufficientBalance && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <Icon name="Wallet" className="text-orange-600 mt-0.5" size={20} />
                  <div>
                    <p className="text-sm font-medium text-orange-700">Пополните баланс</p>
                    <p className="text-sm text-muted-foreground">
                      Для генерации нужно минимум {GENERATION_COST}₽.
                    </p>
                    <Link to="/profile/wallet"><Button size="sm" className="mt-2">Пополнить</Button></Link>
                  </div>
                </div>
              </div>
            )}

            <ReplicateImageUpload
              uploadedImage={personImage}
              handleImageUpload={handlePersonUpload}
              isGenerating={isGenerating}
            />

            <CapsuleClothingList
              garments={garments}
              onUpdate={updateGarment}
              onRemove={removeGarment}
              onImageUpload={handleGarmentImageUpload}
              onAddWithPhoto={() => addGarmentSlot(true)}
              onAddTextOnly={() => addGarmentSlot(false)}
              disabled={isGenerating}
            />

            {garments.length > 0 && (
              <ClothingMultiSelect
                garments={garments}
                selectedIndices={modelOutfit}
                onSelectionChange={setModelOutfit}
                label="Что надеть на модель (слева)"
              />
            )}

            <div>
              <Label className="text-sm font-semibold mb-1.5 block">Заголовок капсулы</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="напр: PASTEL CITY CAPSULE"
                disabled={isGenerating}
              />
            </div>

            <div>
              <Label className="text-sm font-semibold mb-1.5 block">Промт</Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Опишите образ модели и фон (напр: городская улица, нежные пастельные тона)"
                rows={3}
                disabled={isGenerating}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="show-labels"
                checked={showLabels}
                onCheckedChange={(v) => setShowLabels(!!v)}
                disabled={isGenerating}
              />
              <label htmlFor="show-labels" className="text-sm cursor-pointer">
                Подписи на изображении
              </label>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleGenerate}
                disabled={
                  !personImage ||
                  garments.length === 0 ||
                  isGenerating ||
                  !user ||
                  (hasInsufficientBalance && !user?.unlimited_access)
                }
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Icon name="Loader2" className="mr-2 animate-spin" size={20} />
                    {generationStatus || "Генерация..."}
                  </>
                ) : (
                  <>
                    <Icon name="Sparkles" className="mr-2" size={20} />
                    Создать капсулу
                  </>
                )}
              </Button>

              {!user?.unlimited_access && !isGenerating && (
                <p className="text-sm text-muted-foreground text-center">
                  Стоимость генерации: {GENERATION_COST}₽
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <ReplicateResultPanel
          isGenerating={isGenerating}
          generatedImage={generatedImage}
          handleDownloadImage={handleDownloadImage}
          setShowSaveDialog={() => {}}
          handleReset={handleReset}
          hasTimedOut={hasTimedOut}
        />
      </div>

      {tempImageForCrop && (
        <ImageCropper
          image={tempImageForCrop}
          open={showCropper}
          onClose={() => {
            setShowCropper(false);
            setTempImageForCrop(null);
          }}
          onCropComplete={handleCropComplete}
          aspectRatio={3 / 4}
        />
      )}
    </>
  );
}
