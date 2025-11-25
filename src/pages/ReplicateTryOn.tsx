import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Icon from '@/components/ui/icon';
import { Link } from 'react-router-dom';
import ReplicateImageUpload from '@/components/replicate/ReplicateImageUpload';
import ReplicateClothingSelector from '@/components/replicate/ReplicateClothingSelector';
import ReplicateResultPanel from '@/components/replicate/ReplicateResultPanel';
import ReplicateSaveDialog from '@/components/replicate/ReplicateSaveDialog';

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
                  <ReplicateImageUpload
                    uploadedImage={uploadedImage}
                    handleImageUpload={handleImageUpload}
                    isGenerating={isGenerating}
                  />

                  <ReplicateClothingSelector
                    selectedClothingItems={selectedClothingItems}
                    clothingCatalog={clothingCatalog}
                    filters={filters}
                    selectedCategories={selectedCategories}
                    selectedColors={selectedColors}
                    selectedArchetypes={selectedArchetypes}
                    setSelectedCategories={setSelectedCategories}
                    setSelectedColors={setSelectedColors}
                    setSelectedArchetypes={setSelectedArchetypes}
                    toggleClothingSelection={toggleClothingSelection}
                    removeClothingItem={removeClothingItem}
                    updateClothingCategory={updateClothingCategory}
                    handleCustomClothingUpload={handleCustomClothingUpload}
                    isGenerating={isGenerating}
                    REPLICATE_CATEGORIES={REPLICATE_CATEGORIES}
                  />

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

            <ReplicateResultPanel
              isGenerating={isGenerating}
              generatedImage={generatedImage}
              handleDownloadImage={handleDownloadImage}
              setShowSaveDialog={setShowSaveDialog}
              handleReset={handleReset}
            />
          </div>
        </div>
      </div>

      <ReplicateSaveDialog
        showSaveDialog={showSaveDialog}
        setShowSaveDialog={setShowSaveDialog}
        lookbooks={lookbooks}
        selectedLookbookId={selectedLookbookId}
        setSelectedLookbookId={setSelectedLookbookId}
        handleSaveToExistingLookbook={handleSaveToExistingLookbook}
        isSaving={isSaving}
        newLookbookName={newLookbookName}
        setNewLookbookName={setNewLookbookName}
        newLookbookPersonName={newLookbookPersonName}
        setNewLookbookPersonName={setNewLookbookPersonName}
        handleSaveToNewLookbook={handleSaveToNewLookbook}
      />
    </Layout>
  );
}
