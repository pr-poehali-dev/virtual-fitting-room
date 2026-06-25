import React from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Icon from "@/components/ui/icon";
import ImageViewer from "@/components/ImageViewer";

interface ClothingItem {
  id: string;
  image_url: string;
  name: string;
  description: string;
  categories: string[];
  colors: string[];
  archetypes: string[];
  replicate_category?: string;
}

interface FilterOption {
  id: number | string;
  name: string;
}

interface Filters {
  categories: FilterOption[];
  colors: FilterOption[];
  archetypes: FilterOption[];
  genders: FilterOption[];
}

interface SelectedClothing {
  id: string;
  image: string;
  name?: string;
  category?: string;
  isFromCatalog?: boolean;
  product_url?: string;
}

interface ReplicateClothingSelectorProps {
  selectedClothingItems: SelectedClothing[];
  clothingCatalog: ClothingItem[];
  filters: Filters | null;
  selectedCategories: number[];
  selectedColors: number[];
  selectedArchetypes: number[];
  selectedGender: string;
  setSelectedCategories: (categories: number[]) => void;
  setSelectedColors: (colors: number[]) => void;
  setSelectedArchetypes: (archetypes: number[]) => void;
  setSelectedGender: (gender: string) => void;
  toggleClothingSelection: (item: ClothingItem) => void;
  removeClothingItem: (id: string) => void;
  updateClothingCategory: (id: string, category: string) => void;
  updateClothingName: (id: string, name: string) => void;
  addTextOnlyItem: () => void;
  addWildberriesItem: (url: string) => Promise<boolean>;
  handleCustomClothingUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isGenerating: boolean;
  showCategoryError: boolean;
}

const MAX_TRYON_ITEMS = 10;

export default function ReplicateClothingSelector({
  selectedClothingItems,
  clothingCatalog,
  filters,
  selectedCategories,
  selectedColors,
  selectedArchetypes,
  selectedGender,
  setSelectedCategories,
  setSelectedColors,
  setSelectedArchetypes,
  setSelectedGender,
  toggleClothingSelection,
  removeClothingItem,
  updateClothingCategory,
  updateClothingName,
  addTextOnlyItem,
  addWildberriesItem,
  handleCustomClothingUpload,
  isGenerating,
  showCategoryError,
}: ReplicateClothingSelectorProps) {
  const [filtersExpanded, setFiltersExpanded] = React.useState(false);
  const [wbUrl, setWbUrl] = React.useState("");
  const [wbLoading, setWbLoading] = React.useState(false);

  const itemsCount = selectedClothingItems?.length || 0;
  const limitReached = itemsCount >= MAX_TRYON_ITEMS;

  const handleAddWb = async () => {
    if (!wbUrl.trim()) return;
    setWbLoading(true);
    const ok = await addWildberriesItem(wbUrl.trim());
    setWbLoading(false);
    if (ok) setWbUrl("");
  };

  return (
    <div>
      <Label className="text-lg font-semibold mb-2 block">
        <Icon name="Shirt" className="inline mr-2" size={20} />
        2. Выберите вещи для примерки
      </Label>
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <Icon name="Info" className="inline mr-1" size={16} />
          Добавьте до {MAX_TRYON_ITEMS} вещей: одежда, обувь, сумки, аксессуары,
          украшения. Если на фото несколько вещей — напишите в названии, что
          именно примерить.
        </p>
      </div>

      {itemsCount > 0 && (
        <div className="mb-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Выбрано: {itemsCount} / {MAX_TRYON_ITEMS}
          </p>
          <div className="space-y-3">
            {selectedClothingItems?.map((item) => (
              <div
                key={item.id}
                className="flex gap-3 p-3 border rounded-lg bg-card"
              >
                <div className="relative flex-shrink-0 w-20 h-20">
                  {item.image ? (
                    <ImageViewer
                      src={item.image}
                      alt={item.name || "Clothing"}
                      className="w-full h-full object-cover rounded border-2 border-primary bg-muted"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center rounded border-2 border-dashed border-primary/50 bg-muted text-muted-foreground">
                      <Icon name="Type" size={22} />
                    </div>
                  )}
                  <button
                    onClick={() => removeClothingItem(item.id)}
                    className="absolute -top-2 -right-2 bg-gray-600 hover:bg-gray-700 text-white rounded-full p-1 shadow-sm transition-colors"
                    disabled={isGenerating}
                  >
                    <Icon name="X" size={14} />
                  </button>
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  {item.isFromCatalog || item.product_url ? (
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {item.name || "Вещь"}
                      </p>
                      {item.product_url && (
                        <a
                          href={item.product_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-800"
                          title="Открыть товар на Wildberries"
                        >
                          <Icon name="ExternalLink" size={14} />
                          WB
                        </a>
                      )}
                    </div>
                  ) : (
                    <Input
                      value={item.name || ""}
                      onChange={(e) =>
                        updateClothingName(item.id, e.target.value)
                      }
                      disabled={isGenerating}
                      placeholder={
                        item.image
                          ? "Название / что взять с фото (необязательно)"
                          : "Опишите вещь (например: бежевая сумка)"
                      }
                      className="h-9 text-sm"
                    />
                  )}
                  {!(item.isFromCatalog || item.product_url) && (
                    <p className="text-xs text-muted-foreground">
                      {item.image
                        ? "Если на фото несколько вещей — уточните, что примерить"
                        : "Вещь будет создана по описанию"}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              multiple
              onChange={handleCustomClothingUpload}
              className="hidden"
              id="clothing-upload"
              disabled={isGenerating || limitReached}
            />
            <label htmlFor="clothing-upload">
              <Button
                type="button"
                variant="outline"
                className={`w-full ${isGenerating || limitReached ? "opacity-50 cursor-not-allowed" : ""}`}
                disabled={isGenerating || limitReached}
                asChild
              >
                <span>
                  <Icon name="Upload" className="mr-2" size={16} />
                  Загрузить свои вещи
                </span>
              </Button>
            </label>
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={addTextOnlyItem}
            disabled={isGenerating || limitReached}
          >
            <Icon name="Type" className="mr-2" size={16} />
            Добавить по описанию
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={wbUrl}
            onChange={(e) => setWbUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddWb();
              }
            }}
            placeholder="Ссылка на товар Wildberries"
            disabled={isGenerating || limitReached || wbLoading}
            className="h-10 text-sm w-full"
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleAddWb}
            disabled={isGenerating || limitReached || wbLoading || !wbUrl.trim()}
            className="flex-shrink-0 w-full sm:w-auto"
          >
            {wbLoading ? (
              <Icon name="Loader2" className="animate-spin" size={16} />
            ) : (
              <>
                <Icon name="Link" className="mr-2" size={16} />
                Добавить
              </>
            )}
          </Button>
        </div>

        {filters && (
          <div className="border rounded-lg">
            <button
              type="button"
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
            >
              <span className="text-sm font-medium">Фильтры каталога</span>
              <Icon
                name={filtersExpanded ? "ChevronUp" : "ChevronDown"}
                size={20}
                className="text-muted-foreground"
              />
            </button>

            {filtersExpanded && (
              <div className="p-3 pt-0 border-t">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <p className="text-sm font-medium mb-2">Категории</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto border rounded p-2 bg-background">
                      {filters.categories?.map((category) => (
                        <label
                          key={category.id}
                          className="flex items-center space-x-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCategories.includes(
                              category.id as number,
                            )}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCategories([
                                  ...selectedCategories,
                                  category.id as number,
                                ]);
                              } else {
                                setSelectedCategories(
                                  selectedCategories.filter(
                                    (id) => id !== category.id,
                                  ),
                                );
                              }
                            }}
                            className="rounded"
                          />
                          <span className="text-sm">{category.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">Цвета</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto border rounded p-2 bg-background">
                      {filters.colors?.map((color) => (
                        <label
                          key={color.id}
                          className="flex items-center space-x-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedColors.includes(
                              color.id as number,
                            )}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedColors([
                                  ...selectedColors,
                                  color.id as number,
                                ]);
                              } else {
                                setSelectedColors(
                                  selectedColors.filter(
                                    (id) => id !== color.id,
                                  ),
                                );
                              }
                            }}
                            className="rounded"
                          />
                          <span className="text-sm">{color.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">Архетипы</p>
                    <div className="space-y-1 max-h-32 overflow-y-auto border rounded p-2 bg-background">
                      {filters.archetypes?.map((arch) => (
                        <label
                          key={arch.id}
                          className="flex items-center space-x-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedArchetypes.includes(
                              arch.id as number,
                            )}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedArchetypes([
                                  ...selectedArchetypes,
                                  arch.id as number,
                                ]);
                              } else {
                                setSelectedArchetypes(
                                  selectedArchetypes.filter(
                                    (id) => id !== arch.id,
                                  ),
                                );
                              }
                            }}
                            className="rounded"
                          />
                          <span className="text-sm">{arch.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium mb-2">Пол</p>
                    <select
                      value={selectedGender}
                      onChange={(e) => setSelectedGender(e.target.value)}
                      className="w-full p-2 border rounded text-sm bg-background"
                    >
                      <option value="">Все</option>
                      {filters.genders?.map((gender) => (
                        <option key={gender.id} value={gender.id}>
                          {gender.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {(selectedCategories.length > 0 ||
                  selectedColors.length > 0 ||
                  selectedArchetypes.length > 0 ||
                  selectedGender) && (
                  <div className="pt-3 border-t mt-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedCategories([]);
                        setSelectedColors([]);
                        setSelectedArchetypes([]);
                        setSelectedGender("");
                      }}
                      className="w-full"
                    >
                      <Icon name="X" className="mr-2" size={16} />
                      Сбросить фильтр
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="max-h-64 overflow-y-auto border rounded-lg p-4">
          {(clothingCatalog?.length || 0) > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {clothingCatalog?.map((item) => {
                const isSelected =
                  selectedClothingItems?.some((i) => i.id === item.id) ?? false;
                const isDisabled =
                  isGenerating || (limitReached && !isSelected);
                return (
                  <div
                    key={item.id}
                    onClick={() => !isDisabled && toggleClothingSelection(item)}
                    className={`rounded-lg border-2 transition-all ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-transparent hover:border-gray-300"
                    } ${
                      isDisabled
                        ? "opacity-50 cursor-not-allowed"
                        : "cursor-pointer"
                    }`}
                  >
                    <ImageViewer
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-20 object-contain rounded bg-muted"
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-center text-muted-foreground">
              Каталог пуст
            </p>
          )}
        </div>
      </div>
    </div>
  );
}