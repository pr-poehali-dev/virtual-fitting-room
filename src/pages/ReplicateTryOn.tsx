import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Icon from '@/components/ui/icon';
import ImageViewer from '@/components/ImageViewer';
import { Link } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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

const CATALOG_API = 'https://functions.poehali.dev/e65f7df8-0a43-4921-8dbd-3dc0587255cc';

const REPLICATE_CATEGORIES = [
  { value: 'Весь образ', label: 'Весь образ' },
  { value: 'upper_body', label: 'Верх (блузки, рубашки, джемперы, куртки)' },
  { value: 'lower_body', label: 'Низ (брюки, джинсы, юбки, шорты)' },
  { value: 'dresses', label: 'Платья, сарафаны и комбинезоны' },
];

export default function ReplicateTryOn() {
  const { user } = useAuth();
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [selectedClothingItems, setSelectedClothingItems] = useState<SelectedClothing[]>([]);
  const [clothingCatalog, setClothingCatalog] = useState<ClothingItem[]>([]);
  const [promptHints, setPromptHints] = useState<string>('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lookbooks, setLookbooks] = useState<any[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newLookbookName, setNewLookbookName] = useState('');
  const [newLookbookPersonName, setNewLookbookPersonName] = useState('');
  const [selectedLookbookId, setSelectedLookbookId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [selectedColors, setSelectedColors] = useState<number[]>([]);
  const [selectedArchetypes, setSelectedArchetypes] = useState<number[]>([]);

  useEffect(() => {
    fetchFilters();
    if (user) {
      fetchLookbooks();
    }
  }, [user]);

  useEffect(() => {
    fetchCatalog();
  }, [selectedCategories, selectedColors, selectedArchetypes]);

  const fetchFilters = async () => {
    try {
      const response = await fetch(`${CATALOG_API}?action=filters`);
      if (response.ok) {
        const data = await response.json();
        setFilters(data);
      }
    } catch (error) {
      console.error('Failed to fetch filters:', error);
    }
  };

  const fetchCatalog = async () => {
    try {
      const params = new URLSearchParams({ action: 'list' });
      if (selectedCategories.length > 0) {
        params.append('categories', selectedCategories.join(','));
      }
      if (selectedColors.length > 0) {
        params.append('colors', selectedColors.join(','));
      }
      if (selectedArchetypes.length > 0) {
        params.append('archetypes', selectedArchetypes.join(','));
      }
      const response = await fetch(`${CATALOG_API}?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setClothingCatalog(data);
      }
    } catch (error) {
      console.error('Failed to fetch catalog:', error);
    }
  };

  const fetchLookbooks = async () => {
    if (!user) return;
    
    try {
      const response = await fetch('https://functions.poehali.dev/69de81d7-5596-4e1d-bbd3-4b3e1a520d6b', {
        headers: {
          'X-User-Id': user.id
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setLookbooks(data);
      }
    } catch (error) {
      console.error('Failed to fetch lookbooks:', error);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCustomClothingUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const id = `custom-${Date.now()}-${Math.random()}`;
        setSelectedClothingItems((prev) => [
          ...prev,
          {
            id,
            image: reader.result as string,
            name: file.name,
            category: 'upper_body',
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const toggleClothingSelection = (item: ClothingItem) => {
    const exists = selectedClothingItems.find((i) => i.id === item.id);
    if (exists) {
      setSelectedClothingItems((prev) => prev.filter((i) => i.id !== item.id));
    } else {
      setSelectedClothingItems((prev) => [
        ...prev,
        {
          id: item.id,
          image: item.image_url,
          name: item.name,
          category: item.replicate_category || 'upper_body',
        },
      ]);
    }
  };

  const removeClothingItem = (id: string) => {
    setSelectedClothingItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateClothingCategory = (id: string, category: string) => {
    setSelectedClothingItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, category } : item))
    );
  };

  const toggleFilter = (array: number[], value: number) => {
    return array.includes(value)
      ? array.filter(v => v !== value)
      : [...array, value];
  };

  const handleGenerate = async () => {
    if (!uploadedImage) {
      toast.error('Загрузите фото модели');
      return;
    }

    if (selectedClothingItems.length === 0) {
      toast.error('Выберите хотя бы одну вещь');
      return;
    }

    if (!user) {
      toast.error('Требуется авторизация');
      return;
    }

    setIsGenerating(true);
    setGeneratedImage(null);

    try {
      const response = await fetch('https://functions.poehali.dev/bb741663-c984-4bcb-b42e-c99793fd7e10', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': user.id,
        },
        body: JSON.stringify({
          person_image: uploadedImage,
          garments: selectedClothingItems.map((item) => ({
            image: item.image,
            category: item.category || 'upper_body',
          })),
          prompt_hints: promptHints,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка генерации');
      }

      const data = await response.json();
      setGeneratedImage(data.result_url);
      toast.success('Изображение сгенерировано!');
    } catch (error: any) {
      console.error('Generation error:', error);
      toast.error(error.message || 'Ошибка при генерации изображения');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    setUploadedImage(null);
    setSelectedClothingItems([]);
    setGeneratedImage(null);
    setPromptHints('');
  };

  const handleSaveToExistingLookbook = async () => {
    if (!selectedLookbookId || !generatedImage || !user) return;

    setIsSaving(true);
    try {
      const lookbook = lookbooks.find(lb => lb.id === selectedLookbookId);
      const updatedPhotos = [...(lookbook?.photos || []), generatedImage];

      const response = await fetch('https://functions.poehali.dev/69de81d7-5596-4e1d-bbd3-4b3e1a520d6b', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': user.id
        },
        body: JSON.stringify({
          id: selectedLookbookId,
          photos: updatedPhotos
        })
      });

      if (response.ok) {
        toast.success('Фото добавлено в лукбук!');
        setShowSaveDialog(false);
        setSelectedLookbookId('');
        await fetchLookbooks();
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      toast.error('Ошибка сохранения');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveToNewLookbook = async () => {
    if (!newLookbookName || !newLookbookPersonName || !generatedImage || !user) return;

    setIsSaving(true);
    try {
      const response = await fetch('https://functions.poehali.dev/69de81d7-5596-4e1d-bbd3-4b3e1a520d6b', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': user.id
        },
        body: JSON.stringify({
          name: newLookbookName,
          person_name: newLookbookPersonName,
          photos: [generatedImage],
          color_palette: []
        })
      });

      if (response.ok) {
        toast.success('Лукбук создан!');
        setShowSaveDialog(false);
        setNewLookbookName('');
        setNewLookbookPersonName('');
        await fetchLookbooks();
      } else {
        throw new Error('Failed to create lookbook');
      }
    } catch (error) {
      toast.error('Ошибка создания лукбука');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadImage = async () => {
    if (!generatedImage) return;

    try {
      const response = await fetch(generatedImage);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `replicate-tryon-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Изображение скачано!');
    } catch (error) {
      toast.error('Ошибка скачивания');
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
        <div className="container mx-auto px-4 py-12">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Replicate Примерочная
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Выберите несколько вещей и создайте идеальный образ с помощью AI. Модель сама определит как надеть одежду на человека
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 mb-12">
            <Card className="animate-scale-in">
              <CardContent className="p-8">
                {!user && (
                  <div className="mb-6 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Icon name="Info" className="text-primary mt-0.5 flex-shrink-0" size={20} />
                      <div>
                        <p className="text-sm font-medium text-primary mb-1">
                          Требуется авторизация
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          Для генерации изображений необходимо войти в аккаунт
                        </p>
                        <div className="flex gap-2">
                          <Link to="/login">
                            <Button size="sm" variant="default">
                              Войти
                            </Button>
                          </Link>
                          <Link to="/register">
                            <Button size="sm" variant="outline">
                              Регистрация
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-6">
                  <div>
                    <Label className="text-lg font-semibold mb-4 block">
                      <Icon name="User" className="inline mr-2" size={20} />
                      1. Загрузите фото модели
                    </Label>
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="model-upload"
                        disabled={isGenerating}
                      />
                      <label
                        htmlFor="model-upload"
                        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer transition-colors ${
                          uploadedImage
                            ? 'border-primary bg-primary/5'
                            : 'border-gray-300 hover:border-primary'
                        } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {uploadedImage ? (
                          <div className="relative w-full">
                            <ImageViewer src={uploadedImage} alt="Uploaded" className="rounded-lg" />
                            <div className="mt-2 text-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={isGenerating}
                              >
                                <Icon name="Upload" className="mr-2" size={16} />
                                Заменить фото
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <Icon name="Upload" size={48} className="text-gray-400 mb-4" />
                            <p className="text-sm text-gray-600 text-center">
                              Нажмите для загрузки фото
                            </p>
                          </>
                        )}
                      </label>
                    </div>
                  </div>

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
                                  value={item.category || 'upper_body'}
                                  onValueChange={(value) => updateClothingCategory(item.id, value)}
                                  disabled={isGenerating}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {REPLICATE_CATEGORIES.map((cat) => (
                                      <SelectItem key={cat.value} value={cat.value} className="text-xs">
                                        {cat.label}
                                      </SelectItem>
                                    ))}
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
                        <div className="space-y-3">
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

                  <div>
                    <Label className="text-lg font-semibold mb-4 block">
                      <Icon name="MessageSquare" className="inline mr-2" size={20} />
                      3. Подсказки для генерации (опционально)
                    </Label>
                    <Textarea
                      placeholder="Например: casual style, bright lighting, outdoor setting"
                      value={promptHints}
                      onChange={(e) => setPromptHints(e.target.value)}
                      rows={3}
                      disabled={isGenerating}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Добавьте дополнительные описания для более точной генерации
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={handleGenerate}
                      disabled={
                        !uploadedImage ||
                        selectedClothingItems.length === 0 ||
                        isGenerating ||
                        !user
                      }
                      className="flex-1"
                      size="lg"
                    >
                      {isGenerating ? (
                        <>
                          <Icon name="Loader2" className="mr-2 animate-spin" size={20} />
                          Генерация...
                        </>
                      ) : (
                        <>
                          <Icon name="Sparkles" className="mr-2" size={20} />
                          Создать образ
                        </>
                      )}
                    </Button>
                    {(uploadedImage || selectedClothingItems.length > 0) && (
                      <Button
                        variant="outline"
                        onClick={handleReset}
                        disabled={isGenerating}
                        size="lg"
                      >
                        <Icon name="RotateCcw" size={20} />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="animate-scale-in">
              <CardHeader>
                <CardTitle className="text-2xl">
                  <Icon name="Image" className="inline mr-2" size={24} />
                  Результат
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                {isGenerating ? (
                  <div className="flex flex-col items-center justify-center h-[500px] space-y-4">
                    <Icon name="Loader2" className="animate-spin text-primary" size={64} />
                    <p className="text-lg font-medium">Создаём образ...</p>
                    <p className="text-sm text-muted-foreground text-center max-w-sm">
                      Это может занять до 2 минут. AI анализирует выбранные вещи и создаёт реалистичный образ
                    </p>
                  </div>
                ) : generatedImage ? (
                  <div className="space-y-4">
                    <ImageViewer
                      src={generatedImage}
                      alt="Generated result"
                      className="rounded-lg"
                    />
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <Button onClick={handleDownloadImage} className="flex-1">
                          <Icon name="Download" className="mr-2" size={16} />
                          Скачать
                        </Button>
                        <Button variant="outline" onClick={() => setShowSaveDialog(true)} className="flex-1">
                          <Icon name="BookOpen" className="mr-2" size={16} />
                          В лукбук
                        </Button>
                      </div>
                      <Button variant="ghost" onClick={handleReset} className="w-full">
                        <Icon name="RotateCcw" className="mr-2" size={16} />
                        Новая примерка
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[500px] text-center space-y-4">
                    <Icon name="ImageOff" size={64} className="text-gray-300" />
                    <div>
                      <p className="text-lg font-medium mb-2">Здесь появится результат</p>
                      <p className="text-sm text-muted-foreground max-w-sm">
                        Загрузите фото модели, выберите вещи и нажмите "Создать образ"
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Сохранить в лукбук</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {lookbooks.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Выбрать существующий лукбук</Label>
                <RadioGroup value={selectedLookbookId} onValueChange={setSelectedLookbookId}>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {lookbooks.map((lookbook) => (
                      <div key={lookbook.id} className="flex items-center space-x-2">
                        <RadioGroupItem value={lookbook.id} id={lookbook.id} />
                        <Label htmlFor={lookbook.id} className="flex-1 cursor-pointer">
                          {lookbook.name} ({lookbook.person_name})
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
                <Button 
                  onClick={handleSaveToExistingLookbook}
                  disabled={!selectedLookbookId || isSaving}
                  className="w-full"
                >
                  {isSaving ? 'Сохранение...' : 'Добавить в выбранный лукбук'}
                </Button>
              </div>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Или создать новый
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="lookbook-name">Название лукбука</Label>
                <Input
                  id="lookbook-name"
                  placeholder="Например: Осенний стиль 2024"
                  value={newLookbookName}
                  onChange={(e) => setNewLookbookName(e.target.value)}
                  disabled={isSaving}
                />
              </div>
              <div>
                <Label htmlFor="person-name">Имя персоны</Label>
                <Input
                  id="person-name"
                  placeholder="Например: Анна"
                  value={newLookbookPersonName}
                  onChange={(e) => setNewLookbookPersonName(e.target.value)}
                  disabled={isSaving}
                />
              </div>
              <Button
                onClick={handleSaveToNewLookbook}
                disabled={!newLookbookName || !newLookbookPersonName || isSaving}
                className="w-full"
              >
                {isSaving ? 'Создание...' : 'Создать новый лукбук'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}