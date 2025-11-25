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
const REPLICATE_START_API = 'https://functions.poehali.dev/c1cb3f04-f40a-4044-87fd-568d0271e1fe';
const REPLICATE_STATUS_API = 'https://functions.poehali.dev/cde034e8-99be-4910-9ea6-f06cc94a6377';



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
  const [taskId, setTaskId] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [generationStatus, setGenerationStatus] = useState<string>('');
  const [intermediateResult, setIntermediateResult] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [totalSteps, setTotalSteps] = useState<number>(0);
  const [waitingContinue, setWaitingContinue] = useState<boolean>(false);

  useEffect(() => {
    fetchFilters();
    if (user) {
      fetchLookbooks();
    }
  }, [user]);

  useEffect(() => {
    fetchCatalog();
  }, [selectedCategories, selectedColors, selectedArchetypes]);

  useEffect(() => {
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [pollingInterval]);

  const fetchFilters = async () => {
    try {
      const response = await fetch(`${CATALOG_API}?action=filters`);
      if (response.ok) {
        const data = await response.json();
        const filteredCategories = data.categories.filter((cat: FilterOption) => 
          !['Обувь', 'Аксессуары', 'Головные уборы'].includes(cat.name)
        );
        setFilters({
          ...data,
          categories: filteredCategories
        });
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

  const resizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const resized = await resizeImage(file, 1440, 1440);
        setUploadedImage(resized);
      } catch (error) {
        console.error('Image resize error:', error);
        toast.error('Ошибка обработки изображения');
      }
    }
  };

  const handleCustomClothingUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const resizedImages = await Promise.all(
        Array.from(files).map(async (file) => {
          const resized = await resizeImage(file, 1440, 1440);
          return {
            id: `custom-${Date.now()}-${Math.random()}`,
            image: resized,
            name: file.name,
            category: '',
          };
        })
      );

      setSelectedClothingItems((prev) => [...prev, ...resizedImages]);
    } catch (error) {
      console.error('Image resize error:', error);
      toast.error('Ошибка обработки изображений');
    }

    e.target.value = '';
  };

  const mapCategoryFromCatalog = (item: ClothingItem): string => {
    if (item.replicate_category) {
      return item.replicate_category;
    }
    
    const firstCategory = item.categories[0]?.toLowerCase() || '';
    
    if (firstCategory.includes('платье') || firstCategory.includes('сарафан')) {
      return 'dresses';
    }
    if (firstCategory.includes('брюк') || firstCategory.includes('джинс') || 
        firstCategory.includes('шорт') || firstCategory.includes('юбк')) {
      return 'lower_body';
    }
    return 'upper_body';
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
          category: mapCategoryFromCatalog(item),
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

    if (selectedClothingItems.length > 5) {
      toast.error('Максимум 5 вещей за раз', {
        duration: 4000
      });
      return;
    }

    if (!user) {
      toast.error('Требуется авторизация');
      return;
    }

    const itemsWithoutCategory = selectedClothingItems.filter(item => !item.category);
    if (itemsWithoutCategory.length > 0) {
      toast.error('Укажите категорию для всех выбранных вещей');
      return;
    }

    setIsGenerating(true);
    setGeneratedImage(null);
    setGenerationStatus('Запускаем генерацию...');

    const estimatedTime = selectedClothingItems.length * 20;
    toast.info(`Генерация займёт ~${estimatedTime}-${estimatedTime + 30} секунд. Можете закрыть страницу и вернуться позже!`, {
      duration: 6000
    });

    try {
      const response = await fetch(REPLICATE_START_API, {
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
        throw new Error(errorData.error || 'Ошибка запуска генерации');
      }

      const data = await response.json();
      setTaskId(data.task_id);
      setGenerationStatus('В очереди...');
      toast.success('Задача создана! Ожидайте результат...');
      
      startPolling(data.task_id);
    } catch (error: any) {
      console.error('Generation error:', error);
      toast.error(error.message || 'Ошибка запуска генерации');
      setIsGenerating(false);
      setGenerationStatus('');
    }
  };

  const startPolling = (taskId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${REPLICATE_STATUS_API}?task_id=${taskId}`);
        if (!response.ok) {
          throw new Error('Ошибка проверки статуса');
        }

        const data = await response.json();
        setCurrentStep(data.current_step || 0);
        setTotalSteps(data.total_steps || 0);
        
        if (data.status === 'pending') {
          setGenerationStatus('В очереди...');
        } else if (data.status === 'processing') {
          setGenerationStatus(`Обрабатывается... Шаг ${data.current_step}/${data.total_steps}`);
        } else if (data.status === 'waiting_continue') {
          setIntermediateResult(data.intermediate_result);
          setIsGenerating(false);
          setWaitingContinue(true);
          setGenerationStatus('');
          toast.success(`Шаг ${data.current_step}/${data.total_steps} готов!`);
          if (pollingInterval) clearInterval(pollingInterval);
        } else if (data.status === 'completed') {
          setGeneratedImage(data.result_url);
          setIsGenerating(false);
          setWaitingContinue(false);
          setGenerationStatus('');
          toast.success('Все шаги завершены!');
          if (pollingInterval) clearInterval(pollingInterval);
        } else if (data.status === 'failed') {
          setIsGenerating(false);
          setWaitingContinue(false);
          setGenerationStatus('');
          toast.error(data.error_message || 'Ошибка генерации');
          if (pollingInterval) clearInterval(pollingInterval);
        }
      } catch (error: any) {
        console.error('Polling error:', error);
      }
    }, 3000);

    setPollingInterval(interval);
  };

  const handleContinueGeneration = async () => {
    if (!taskId) return;

    setWaitingContinue(false);
    setIsGenerating(true);
    setGenerationStatus('Запуск следующего шага...');

    try {
      const response = await fetch('https://functions.poehali.dev/fdb150a0-d5ba-47ec-9d9a-e13595cd92d1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ task_id: taskId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ошибка продолжения генерации');
      }

      toast.success('Следующий шаг запущен!');
      startPolling(taskId);
    } catch (error: any) {
      console.error('Continue error:', error);
      toast.error(error.message || 'Ошибка продолжения генерации');
      setIsGenerating(false);
      setWaitingContinue(true);
      setGenerationStatus('');
    }
  };

  const handleReset = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    setUploadedImage(null);
    setSelectedClothingItems([]);
    setGeneratedImage(null);
    setIntermediateResult(null);
    setPromptHints('');
    setTaskId(null);
    setIsGenerating(false);
    setWaitingContinue(false);
    setGenerationStatus('');
    setCurrentStep(0);
    setTotalSteps(0);
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
    const imageUrl = generatedImage || intermediateResult;
    if (!imageUrl) return;

    try {
      const response = await fetch(imageUrl);
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
                  />

                  {generationStatus && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Icon name="Loader2" className="animate-spin text-blue-600" size={20} />
                        <div>
                          <p className="text-sm font-medium text-blue-900">{generationStatus}</p>
                          <p className="text-xs text-blue-700 mt-1">
                            Можете закрыть страницу и вернуться позже - задача продолжит выполняться
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

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
                          {generationStatus || 'Генерация...'}
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
              intermediateResult={intermediateResult}
              waitingContinue={waitingContinue}
              currentStep={currentStep}
              totalSteps={totalSteps}
              promptHints={promptHints}
              handleDownloadImage={handleDownloadImage}
              setShowSaveDialog={setShowSaveDialog}
              handleReset={handleReset}
              handleContinueGeneration={handleContinueGeneration}
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