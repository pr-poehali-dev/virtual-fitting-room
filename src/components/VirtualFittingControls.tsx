import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Icon from '@/components/ui/icon';

interface ClothingItem {
  id: string;
  image_url: string;
  name: string;
  description: string;
  categories: string[];
  colors: string[];
  archetypes: string[];
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
  comment: string;
  categories: string[];
}

interface VirtualFittingControlsProps {
  uploadedImage: string | null;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  selectedClothingItems: SelectedClothing[];
  customClothingItems: SelectedClothing[];
  clothingCatalog: ClothingItem[];
  filters: Filters | null;
  selectedCategories: number[];
  selectedColors: number[];
  selectedArchetypes: number[];
  setSelectedCategories: (categories: number[]) => void;
  setSelectedColors: (colors: number[]) => void;
  setSelectedArchetypes: (archetypes: number[]) => void;
  toggleClothingSelection: (item: ClothingItem) => void;
  updateClothingComment: (id: string, comment: string) => void;
  setSelectedClothingItems: (items: SelectedClothing[]) => void;
  handleCustomClothingUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  updateCustomClothingCategory: (id: string, category: string) => void;
  updateCustomClothingComment: (id: string, comment: string) => void;
  handleCropImage: (id: string, image: string) => void;
  handleCropPersonImage?: () => void;
  processImageBackground: (imageUrl: string, itemId: string) => Promise<string>;
  setCustomClothingItems: (items: SelectedClothing[]) => void;
  processingImages: Set<string>;
  handleGenerate: () => void;
  isGenerating: boolean;
  loadingProgress: number;
  handleCancelGeneration: () => void;
  onMarkClothingZone: (id: string, image: string, name: string | undefined, isCatalog: boolean) => void;
}

export default function VirtualFittingControls({
  uploadedImage,
  handleImageUpload,
  selectedClothingItems,
  customClothingItems,
  clothingCatalog,
  filters,
  selectedCategories,
  selectedColors,
  selectedArchetypes,
  setSelectedCategories,
  setSelectedColors,
  setSelectedArchetypes,
  toggleClothingSelection,
  updateClothingComment,
  setSelectedClothingItems,
  handleCustomClothingUpload,
  updateCustomClothingCategory,
  updateCustomClothingComment,
  handleCropImage,
  handleCropPersonImage,
  processImageBackground,
  setCustomClothingItems,
  processingImages,
  handleGenerate,
  isGenerating,
  loadingProgress,
  handleCancelGeneration,
  onMarkClothingZone
}: VirtualFittingControlsProps) {
  const toggleFilter = (array: number[], value: number) => {
    return array.includes(value)
      ? array.filter(v => v !== value)
      : [...array, value];
  };

  return (
    <Card className="animate-scale-in">
      <CardContent className="p-8">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-3">
              Загрузите фотографию
            </label>
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="photo-upload"
              />
              <label htmlFor="photo-upload" className="cursor-pointer">
                {uploadedImage ? (
                  <div className="space-y-3">
                    <img src={uploadedImage} alt="Uploaded" className="max-h-64 mx-auto rounded-lg" />
                    {handleCropPersonImage && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          handleCropPersonImage();
                        }}
                      >
                        <Icon name="Crop" className="mr-2" size={16} />
                        Кадрировать
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Icon name="Upload" className="mx-auto text-muted-foreground" size={48} />
                    <p className="text-muted-foreground">
                      Нажмите для загрузки фотографии
                    </p>
                  </div>
                )}
              </label>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium">
                Выберите одежду
              </label>
              {(selectedClothingItems.length > 0 || customClothingItems.length > 0) && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Выбрано: {selectedClothingItems.length + customClothingItems.filter(item => item.categories?.length > 0).length}
                  </span>
                </div>
              )}
            </div>
            <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex gap-2">
                <Icon name="Sparkles" className="text-blue-600 dark:text-blue-500 flex-shrink-0 mt-0.5" size={16} />
                <div className="text-xs text-blue-800 dark:text-blue-300">
                  <p className="font-medium mb-1">✨ Автоматическая обработка изображений:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li><strong>Фон удаляется автоматически</strong> со всех изображений перед примеркой</li>
                    <li>Можете выбирать фото с фоном - AI изолирует только одежду</li>
                    <li>Категория (топ/брюки) помогает AI понять что именно изолировать</li>
                    <li>Порядок примерки: топы → брюки → куртки → обувь → аксессуары</li>
                  </ul>
                </div>
              </div>
            </div>
            {(selectedClothingItems.length + customClothingItems.filter(item => item.categories?.length > 0).length) > 1 && (
              <div className="mb-3 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex gap-2">
                  <Icon name="CheckCircle2" className="text-green-600 dark:text-green-500 flex-shrink-0 mt-0.5" size={16} />
                  <p className="text-xs text-green-800 dark:text-green-300">
                    Выбрано {selectedClothingItems.length + customClothingItems.filter(item => item.categories?.length > 0).length} элементов. Они будут <strong>примерены последовательно</strong> (каждый на результате предыдущего) в оптимальном порядке.
                  </p>
                </div>
              </div>
            )}
            <Accordion type="multiple" className="w-full" defaultValue={["catalog"]}>
              <AccordionItem value="catalog">
                <AccordionTrigger className="text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <Icon name="ShoppingBag" size={18} />
                    Из каталога
                    {selectedClothingItems.length > 0 && (
                      <span className="ml-2 px-2 py-0.5 bg-primary text-primary-foreground rounded-full text-xs">
                        {selectedClothingItems.length}
                      </span>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                <Accordion type="single" collapsible>
                  <AccordionItem value="filters">
                    <AccordionTrigger className="text-sm">
                      <div className="flex items-center gap-2">
                        <Icon name="Filter" size={16} />
                        Фильтры
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      {filters && (
                        <>
                          <div>
                            <p className="text-xs font-medium mb-2">Категории:</p>
                            <div className="flex flex-wrap gap-1">
                              {filters.categories.map((cat) => (
                                <Button
                                  key={cat.id}
                                  size="sm"
                                  variant={selectedCategories.includes(cat.id) ? 'default' : 'outline'}
                                  onClick={() => setSelectedCategories(toggleFilter(selectedCategories, cat.id))}
                                  className="text-xs h-7"
                                >
                                  {cat.name}
                                </Button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-medium mb-2">Цвета:</p>
                            <div className="flex flex-wrap gap-1">
                              {filters.colors.map((color) => (
                                <Button
                                  key={color.id}
                                  size="sm"
                                  variant={selectedColors.includes(color.id) ? 'default' : 'outline'}
                                  onClick={() => setSelectedColors(toggleFilter(selectedColors, color.id))}
                                  className="text-xs h-7"
                                >
                                  {color.name}
                                </Button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-medium mb-2">Архетипы Киббе:</p>
                            <div className="flex flex-wrap gap-1">
                              {filters.archetypes.map((arch) => (
                                <Button
                                  key={arch.id}
                                  size="sm"
                                  variant={selectedArchetypes.includes(arch.id) ? 'default' : 'outline'}
                                  onClick={() => setSelectedArchetypes(toggleFilter(selectedArchetypes, arch.id))}
                                  className="text-xs h-7"
                                >
                                  {arch.name}
                                </Button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
                
                <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
                  {clothingCatalog.length === 0 ? (
                    <p className="col-span-2 text-center text-muted-foreground text-sm py-4">
                      Каталог пуст
                    </p>
                  ) : (
                    clothingCatalog.map((item) => {
                      const isSelected = selectedClothingItems.some(c => c.id === item.id);
                      return (
                        <div
                          key={item.id}
                          className={`relative border-2 rounded-lg overflow-hidden cursor-pointer transition-all ${
                            isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => toggleClothingSelection(item)}
                        >
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-full h-32 object-cover"
                          />
                          {isSelected && (
                            <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                              <Icon name="Check" size={14} />
                            </div>
                          )}
                          {item.name && (
                            <div className="p-2 bg-background/90 backdrop-blur-sm">
                              <p className="text-xs font-medium truncate">{item.name}</p>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
                
                {selectedClothingItems.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Выбрано элементов: {selectedClothingItems.length}</p>
                      {selectedClothingItems.length > 1 && (
                        <p className="text-xs text-muted-foreground">Будут объединены</p>
                      )}
                    </div>
                    {selectedClothingItems.map((item, idx) => (
                      <div key={item.id} className="space-y-2 p-3 border rounded-lg bg-muted/30">
                        <div className="flex items-center gap-2">
                          <img src={item.image} alt="" className="w-12 h-12 object-cover rounded" />
                          <div className="flex-1">
                            {item.categories && item.categories.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-1">
                                {item.categories.map((cat, idx) => (
                                  <span key={idx} className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                                    {cat}
                                  </span>
                                ))}
                              </div>
                            )}
                            {item.zone && (
                              <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                                <Icon name="MapPin" size={12} />
                                Область задана
                              </span>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedClothingItems(selectedClothingItems.filter(c => c.id !== item.id))}
                          >
                            <Icon name="X" size={16} />
                          </Button>
                        </div>
                        <Input
                          placeholder="Комментарий (необязательно)"
                          value={item.comment}
                          onChange={(e) => updateClothingComment(item.id, e.target.value)}
                          className="text-sm"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onMarkClothingZone(item.id, item.image, item.categories[0], true)}
                          className="w-full text-xs"
                          disabled={!uploadedImage}
                        >
                          <Icon name="Target" className="mr-1" size={14} />
                          {item.zone ? 'Изменить область' : 'Указать область на фото'}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="custom">
                <AccordionTrigger className="text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <Icon name="Upload" size={18} />
                    Загрузить своё фото
                    {customClothingItems.length > 0 && (
                      <span className="ml-2 px-2 py-0.5 bg-primary text-primary-foreground rounded-full text-xs">
                        {customClothingItems.length}
                      </span>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-2">
                <div className="mb-3 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex gap-2">
                    <Icon name="Sparkles" className="text-green-600 dark:text-green-500 flex-shrink-0 mt-0.5" size={16} />
                    <div className="text-xs text-green-800 dark:text-green-300">
                      <p className="font-medium mb-1">✨ Удобная загрузка с обработкой:</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        <li><strong>Кадрируйте</strong> - выделите нужную часть одежды для точности</li>
                        <li><strong>Фон удалится автоматически</strong> при генерации</li>
                        <li>Можете загружать фото с любым фоном</li>
                        <li>Главное: предмет виден полностью (не обрезан)</li>
                        <li>Выберите правильную категорию для точного результата</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCustomClothingUpload}
                    className="hidden"
                    id="clothing-upload"
                    multiple
                  />
                  <label htmlFor="clothing-upload" className="cursor-pointer">
                    <div className="space-y-2">
                      <Icon name="Upload" className="mx-auto text-muted-foreground" size={32} />
                      <p className="text-muted-foreground text-sm">
                        Загрузите фото одежды
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Можно выбрать несколько файлов
                      </p>
                    </div>
                  </label>
                </div>
                
                {customClothingItems.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Загружено: {customClothingItems.length}</p>
                      {customClothingItems.length > 1 && (
                        <p className="text-xs text-muted-foreground">Будут объединены</p>
                      )}
                    </div>
                    {customClothingItems.map((item) => (
                      <div key={item.id} className="space-y-2 p-3 border rounded-lg bg-muted/30">
                        <div className="flex items-start gap-2">
                          <img src={item.image} alt="" className="w-16 h-16 object-cover rounded" />
                          <div className="flex-1 space-y-2">
                            <Select 
                              value={item.categories[0] || ''} 
                              onValueChange={(val) => updateCustomClothingCategory(item.id, val)}
                            >
                              <SelectTrigger className="text-sm">
                                <SelectValue placeholder="Выберите категорию" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Весь образ">Весь образ</SelectItem>
                                <SelectItem value="Платье">Платье</SelectItem>
                                <SelectItem value="Топ">Топ / Блузка</SelectItem>
                                <SelectItem value="Брюки">Брюки</SelectItem>
                                <SelectItem value="Юбка">Юбка</SelectItem>
                                <SelectItem value="Куртка">Куртка / Пальто</SelectItem>
                                <SelectItem value="Обувь">Обувь</SelectItem>
                                <SelectItem value="Аксессуар">Аксессуар</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              placeholder="Комментарий (необязательно)"
                              value={item.comment}
                              onChange={(e) => updateCustomClothingComment(item.id, e.target.value)}
                              className="text-sm"
                            />
                            <div className="grid grid-cols-3 gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCropImage(item.id, item.image)}
                                className="text-xs"
                              >
                                <Icon name="Crop" className="mr-1" size={14} />
                                Кадрировать
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                  const processed = await processImageBackground(item.image, item.id);
                                  setCustomClothingItems(customClothingItems.map(i =>
                                    i.id === item.id ? { ...i, image: processed } : i
                                  ));
                                }}
                                disabled={processingImages.has(item.id)}
                                className="text-xs"
                              >
                                {processingImages.has(item.id) ? (
                                  <>
                                    <Icon name="Loader2" className="mr-1 animate-spin" size={14} />
                                    Обработка...
                                  </>
                                ) : (
                                  <>
                                    <Icon name="Scissors" className="mr-1" size={14} />
                                    Удалить фон
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant={item.zone ? 'default' : 'outline'}
                                onClick={() => onMarkClothingZone(item.id, item.image, item.categories[0], false)}
                                disabled={!uploadedImage}
                                className="text-xs"
                              >
                                <Icon name="Target" className="mr-1" size={14} />
                                {item.zone ? 'Изменить' : 'Область'}
                              </Button>
                            </div>
                            {item.zone && (
                              <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                                <Icon name="MapPin" size={12} />
                                Область задана
                              </span>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setCustomClothingItems(customClothingItems.filter(i => i.id !== item.id))}
                          >
                            <Icon name="X" size={16} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating}
            className="w-full h-12 text-base"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Icon name="Loader2" className="mr-2 animate-spin" size={20} />
                Примеряем элементы...
              </>
            ) : (
              <>
                <Icon name="Sparkles" className="mr-2" size={20} />
                {(() => {
                  const totalItems = selectedClothingItems.length + customClothingItems.filter(item => item.categories?.length > 0).length;
                  if (totalItems > 1) {
                    return `Примерить ${totalItems} элемента (${totalItems} этапа)`;
                  }
                  return 'Генерировать изображение';
                })()}
              </>
            )}
          </Button>
          
          {isGenerating && (
            <div className="space-y-3">
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-primary h-full transition-all duration-500 ease-out"
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {loadingProgress < 50 ? 'Отправляем запрос...' : loadingProgress < 90 ? 'AI обрабатывает изображение...' : 'Почти готово...'}
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCancelGeneration}
                className="w-full"
              >
                <Icon name="X" className="mr-2" size={16} />
                Отменить
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}