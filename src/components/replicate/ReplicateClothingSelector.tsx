import React from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import ImageViewer from '@/components/ImageViewer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  id: number;
  name: string;
}

interface Filters {
  categories: FilterOption[];
  colors: FilterOption[];
  archetypes: FilterOption[];
}

interface SelectedClothing {
  id: string;
  image: string;
  name?: string;
  category?: string;
}

interface ReplicateClothingSelectorProps {
  selectedClothingItems: SelectedClothing[];
  clothingCatalog: ClothingItem[];
  filters: Filters | null;
  selectedCategories: number[];
  selectedColors: number[];
  selectedArchetypes: number[];
  setSelectedCategories: (categories: number[]) => void;
  setSelectedColors: (colors: number[]) => void;
  setSelectedArchetypes: (archetypes: number[]) => void;
  toggleClothingSelection: (item: ClothingItem) => void;
  removeClothingItem: (id: string) => void;
  updateClothingCategory: (id: string, category: string) => void;
  handleCustomClothingUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isGenerating: boolean;
}

export default function ReplicateClothingSelector({
  selectedClothingItems,
  clothingCatalog,
  filters,
  selectedCategories,
  selectedColors,
  selectedArchetypes,
  setSelectedCategories,
  setSelectedColors,
  setSelectedArchetypes,
  toggleClothingSelection,
  removeClothingItem,
  updateClothingCategory,
  handleCustomClothingUpload,
  isGenerating
}: ReplicateClothingSelectorProps) {
  const [filtersExpanded, setFiltersExpanded] = React.useState(false);

  const toggleFilter = (array: number[], value: number) => {
    return array.includes(value)
      ? array.filter(v => v !== value)
      : [...array, value];
  };

  return (
    <div>
      <Label className="text-lg font-semibold mb-4 block">
        <Icon name="Shirt" className="inline mr-2" size={20} />
        2. Выберите вещи для примерки
      </Label>

      {selectedClothingItems.length > 0 && (
        <div className="mb-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Выбрано: {selectedClothingItems.length}
          </p>
          <div className="space-y-3">
            {selectedClothingItems.map((item) => (
              <div key={item.id} className="flex gap-3 p-3 border rounded-lg bg-card">
                <div className="relative group flex-shrink-0">
                  <ImageViewer
                    src={item.image}
                    alt={item.name || 'Clothing'}
                    className="w-20 h-20 object-contain rounded border-2 border-primary bg-muted"
                  />
                  <button
                    onClick={() => removeClothingItem(item.id)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    disabled={isGenerating}
                  >
                    <Icon name="X" size={14} />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate mb-2">
                    {item.name || 'Одежда'}
                  </p>
                  <Select
                    value={item.category || ''}
                    onValueChange={(value) => updateClothingCategory(item.id, value)}
                    disabled={isGenerating}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Выберите категорию" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="upper_body" className="text-xs">
                        Верх (Топы, Рубашки, Жакеты)
                      </SelectItem>
                      <SelectItem value="lower_body" className="text-xs">
                        Низ (Брюки, Юбки, Шорты)
                      </SelectItem>
                      <SelectItem value="dresses" className="text-xs">
                        Весь образ, платья, верх и низ вместе
                      </SelectItem>
                      <SelectItem value="shoes" className="text-xs">
                        Обувь
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleCustomClothingUpload}
            className="hidden"
            id="clothing-upload"
            disabled={isGenerating}
          />
          <label htmlFor="clothing-upload">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isGenerating}
              asChild
            >
              <span>
                <Icon name="Upload" className="mr-2" size={16} />
                Загрузить свои вещи
              </span>
            </Button>
          </label>
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
              <div className="p-3 pt-0 space-y-3 border-t">
                <div>
                  <p className="text-xs font-medium mb-2">Фильтр по категории:</p>
                  <div className="flex flex-wrap gap-1">
                    {filters.categories.map((category) => (
                      <Button
                        key={category.id}
                        size="sm"
                        variant={selectedCategories.includes(category.id) ? 'default' : 'outline'}
                        onClick={() => setSelectedCategories(toggleFilter(selectedCategories, category.id))}
                        className="h-7 text-xs px-2"
                      >
                        {category.name}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium mb-2">Фильтр по цвету:</p>
                  <div className="flex flex-wrap gap-1">
                    {filters.colors.map((color) => (
                      <Button
                        key={color.id}
                        size="sm"
                        variant={selectedColors.includes(color.id) ? 'default' : 'outline'}
                        onClick={() => setSelectedColors(toggleFilter(selectedColors, color.id))}
                        className="h-7 text-xs px-2"
                      >
                        {color.name}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium mb-2">Фильтр по архетипу:</p>
                  <div className="flex flex-wrap gap-1">
                    {filters.archetypes.map((arch) => (
                      <Button
                        key={arch.id}
                        size="sm"
                        variant={selectedArchetypes.includes(arch.id) ? 'default' : 'outline'}
                        onClick={() => setSelectedArchetypes(toggleFilter(selectedArchetypes, arch.id))}
                        className="h-7 text-xs px-2"
                      >
                        {arch.name}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="max-h-64 overflow-y-auto border rounded-lg p-4">
          {clothingCatalog.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {clothingCatalog.map((item) => {
                const isSelected = selectedClothingItems.some(
                  (i) => i.id === item.id
                );
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleClothingSelection(item)}
                    className={`cursor-pointer rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-transparent hover:border-gray-300'
                    } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
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