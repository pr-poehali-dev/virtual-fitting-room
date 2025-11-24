import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
  name?: string;
  categories: string[];
}

interface VirtualFittingControlsProps {
  uploadedImage: string | null;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  selectedClothing: SelectedClothing | null;
  clothingCatalog: ClothingItem[];
  filters: Filters | null;
  selectedColors: number[];
  selectedArchetypes: number[];
  setSelectedColors: (colors: number[]) => void;
  setSelectedArchetypes: (archetypes: number[]) => void;
  toggleClothingSelection: (item: ClothingItem) => void;
  setSelectedClothing: (clothing: SelectedClothing | null) => void;
  handleCustomClothingUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleGenerate: () => void;
  isGenerating: boolean;
  loadingProgress: number;
  handleCancelGeneration: () => void;
}

export default function VirtualFittingControls({
  uploadedImage,
  handleImageUpload,
  selectedClothing,
  clothingCatalog,
  filters,
  selectedColors,
  selectedArchetypes,
  setSelectedColors,
  setSelectedArchetypes,
  toggleClothingSelection,
  setSelectedClothing,
  handleCustomClothingUpload,
  handleGenerate,
  isGenerating,
  loadingProgress,
  handleCancelGeneration
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
                  <img src={uploadedImage} alt="Uploaded" className="max-h-64 mx-auto rounded-lg" />
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
                Выберите одну вещь
              </label>
              {selectedClothing && (
                <span className="text-xs text-muted-foreground">
                  Выбрано
                </span>
              )}
            </div>
            
            <Accordion type="multiple" className="w-full" defaultValue={["catalog"]}>
              <AccordionItem value="catalog">
                <AccordionTrigger className="text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <Icon name="ShoppingBag" size={18} />
                    Из каталога
                    {selectedClothing && !selectedClothing.id.startsWith('custom-') && (
                      <span className="ml-2 px-2 py-0.5 bg-primary text-primary-foreground rounded-full text-xs">
                        1
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
                              <p className="text-xs font-medium mb-2">Типажи Киббе:</p>
                              <div className="flex flex-wrap gap-1">
                                {filters.archetypes.map((archetype) => (
                                  <Button
                                    key={archetype.id}
                                    size="sm"
                                    variant={selectedArchetypes.includes(archetype.id) ? 'default' : 'outline'}
                                    onClick={() => setSelectedArchetypes(toggleFilter(selectedArchetypes, archetype.id))}
                                    className="text-xs h-7"
                                  >
                                    {archetype.name}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>

                  <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
                    {clothingCatalog.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => toggleClothingSelection(item)}
                        className={`relative cursor-pointer rounded-lg border-2 overflow-hidden transition-all hover:shadow-lg ${
                          selectedClothing?.id === item.id
                            ? 'border-primary shadow-md'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-full h-32 object-cover"
                        />
                        {selectedClothing?.id === item.id && (
                          <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                            <Icon name="Check" size={16} />
                          </div>
                        )}
                        <div className="p-2 bg-background/95">
                          <p className="text-xs font-medium truncate">{item.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="custom">
                <AccordionTrigger className="text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <Icon name="Plus" size={18} />
                    Загрузить свою
                    {selectedClothing?.id.startsWith('custom-') && (
                      <span className="ml-2 px-2 py-0.5 bg-primary text-primary-foreground rounded-full text-xs">
                        1
                      </span>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2">
                  <div className="space-y-3">
                    <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary transition-colors cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCustomClothingUpload}
                        className="hidden"
                        id="custom-clothing-upload"
                      />
                      <label htmlFor="custom-clothing-upload" className="cursor-pointer">
                        <Icon name="Upload" className="mx-auto text-muted-foreground mb-2" size={32} />
                        <p className="text-xs text-muted-foreground">
                          Нажмите чтобы загрузить фото одежды
                        </p>
                      </label>
                    </div>

                    {selectedClothing?.id.startsWith('custom-') && (
                      <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
                        <img
                          src={selectedClothing.image}
                          alt="Custom clothing"
                          className="w-full h-32 object-contain rounded"
                        />
                        <p className="text-xs text-center text-muted-foreground">
                          {selectedClothing.name || 'Ваша одежда'}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedClothing(null)}
                          className="w-full"
                        >
                          <Icon name="X" className="mr-2" size={14} />
                          Удалить
                        </Button>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {!isGenerating ? (
            <Button
              onClick={handleGenerate}
              disabled={!uploadedImage || !selectedClothing}
              className="w-full"
              size="lg"
            >
              <Icon name="Sparkles" className="mr-2" size={20} />
              Примерить
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="relative w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full bg-primary transition-all duration-300"
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Генерация... {Math.round(loadingProgress)}%
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelGeneration}
                >
                  <Icon name="X" className="mr-2" size={14} />
                  Отменить
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
