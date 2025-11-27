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
  selectedGender,
  setSelectedCategories,
  setSelectedColors,
  setSelectedArchetypes,
  setSelectedGender,
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

  const getCategoryHint = (itemId: string, currentCategory: string | undefined) => {
    if (selectedClothingItems.length === 1) {
      if (currentCategory === 'dresses') {
        return 'Это фото полного образа';
      }
      return 'Любая категория';
    }
    
    if (selectedClothingItems.length === 2) {
      const otherItem = selectedClothingItems.find(item => item.id !== itemId);
      if (!otherItem || !otherItem.category) {
        return 'Выберите категорию';
      }
      
      if (currentCategory === 'dresses') {
        return 'Это фото полного образа (нельзя комбинировать с другими вещами)';
      }
      
      if (otherItem.category === 'dresses') {
        return 'Другая вещь — полный образ (нельзя комбинировать)';
      }
      
      if (otherItem.category === 'upper_body') {
        if (currentCategory === 'upper_body') {
          return 'Выберите фото из категории низ (брюки, шорты, юбки)';
        }
        return currentCategory === 'lower_body' ? 'Низ (правильно ✓)' : 'Нужен низ (брюки, юбки, шорты)';
      }
      
      if (otherItem.category === 'lower_body') {
        if (currentCategory === 'lower_body') {
          return 'Выберите фото из категории верх (топы, рубашки, жакеты)';
        }
        return currentCategory === 'upper_body' ? 'Верх (правильно ✓)' : 'Нужен верх (топы, рубашки, жакеты)';
      }
    }
    
    return '';
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
          Можно выбрать 1 вещь (любой категории) или 2 вещи (верх + низ)
        </p>
      </div>

      {selectedClothingItems.length > 0 && (
        <div className="mb-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Выбрано: {selectedClothingItems.length}
          </p>
          <div className="space-y-3">
            {selectedClothingItems.map((item) => (
              <div key={item.id} className="flex gap-3 p-3 border rounded-lg bg-card">
                <div className="relative flex-shrink-0 w-20 h-20">
                  <ImageViewer
                    src={item.image}
                    alt={item.name || 'Clothing'}
                    className="w-full h-full object-cover rounded border-2 border-primary bg-muted"
                  />
                  <button
                    onClick={() => removeClothingItem(item.id)}
                    className="absolute -top-2 -right-2 bg-gray-600 hover:bg-gray-700 text-white rounded-full p-1 shadow-sm transition-colors"
                    disabled={isGenerating}
                  >
                    <Icon name="X" size={14} />
                  </button>
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <p className="text-sm font-medium truncate">
                    {item.name || 'Одежда'}
                  </p>
                  <Select
                    value={item.category || ''}
                    onValueChange={(value) => updateClothingCategory(item.id, value)}
                    disabled={isGenerating || (selectedClothingItems.length === 2 && item.category && selectedClothingItems.find(i => i.id !== item.id && i.category && i.category !== item.category && ['upper_body', 'lower_body'].includes(i.category)) !== undefined)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Выберите категорию" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedClothingItems.length === 1 || selectedClothingItems.find(i => i.id !== item.id)?.category !== 'lower_body' ? (
                        <SelectItem value="upper_body" className="text-xs">
                          Верх (Топы, Рубашки, Жакеты)
                        </SelectItem>
                      ) : null}
                      {selectedClothingItems.length === 1 || selectedClothingItems.find(i => i.id !== item.id)?.category !== 'upper_body' ? (
                        <SelectItem value="lower_body" className="text-xs">
                          Низ (Брюки, Юбки, Шорты)
                        </SelectItem>
                      ) : null}
                      {selectedClothingItems.length === 1 ? (
                        <SelectItem value="dresses" className="text-xs">
                          Весь образ, платья, верх и низ вместе
                        </SelectItem>
                      ) : null}
                    </SelectContent>
                  </Select>
                  {getCategoryHint(item.id, item.category) && (
                    <p className="text-xs text-muted-foreground">
                      {getCategoryHint(item.id, item.category)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedClothingItems.length > 0 && selectedClothingItems[0].category === 'dresses' && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-900">
            <Icon name="AlertCircle" className="inline mr-1" size={16} />
            Выбран полный образ. Удалите его, если хотите выбрать другие вещи
          </p>
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
            disabled={isGenerating || (selectedClothingItems.length > 0 && selectedClothingItems[0].category === 'dresses')}
          />
          <label htmlFor="clothing-upload">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isGenerating || (selectedClothingItems.length > 0 && selectedClothingItems[0].category === 'dresses')}
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
              <div className="p-3 pt-0 space-y-4 border-t">
                <div className="pt-2">
                  <p className="text-xs font-bold mb-2">Фильтр по категории:</p>
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

                <div className="pt-2">
                  <p className="text-xs font-bold mb-2">Фильтр по цвету:</p>
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

                <div className="pt-2">
                  <p className="text-xs font-bold mb-2">Фильтр по архетипу:</p>
                  <div className="flex flex-wrap gap-1">
                    {filters.archetypes.map((arch) => (
                      <Button
                        key={arch.id}
                        size="sm"
                        variant={selectedArchetypes.includes(arch.id as number) ? 'default' : 'outline'}
                        onClick={() => setSelectedArchetypes(toggleFilter(selectedArchetypes, arch.id as number))}
                        className="h-7 text-xs px-2"
                      >
                        {arch.name}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="pt-2">
                  <p className="text-xs font-bold mb-2">Фильтр по полу:</p>
                  <div className="flex flex-wrap gap-1">
                    {filters.genders.map((gender) => (
                      <Button
                        key={gender.id}
                        size="sm"
                        variant={selectedGender === gender.id ? 'default' : 'outline'}
                        onClick={() => setSelectedGender(selectedGender === gender.id ? '' : gender.id as string)}
                        className="h-7 text-xs px-2"
                      >
                        {gender.name}
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
                const isDisabled = isGenerating || (selectedClothingItems.length > 0 && selectedClothingItems[0].category === 'dresses' && !isSelected);
                return (
                  <div
                    key={item.id}
                    onClick={() => !isDisabled && toggleClothingSelection(item)}
                    className={`rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-transparent hover:border-gray-300'
                    } ${
                      isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
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