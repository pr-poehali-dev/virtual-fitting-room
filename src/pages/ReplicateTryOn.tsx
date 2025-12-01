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
import ImageCropper from '@/components/ImageCropper';
import { checkReplicateBalance, deductReplicateBalance } from '@/utils/replicateBalanceUtils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

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
}

const CATALOG_API = 'https://functions.poehali.dev/e65f7df8-0a43-4921-8dbd-3dc0587255cc';
const SEEDREAM_START_API = 'https://functions.poehali.dev/4bb70873-fda7-4a2d-a0a8-ee558a3b50e7';
const SEEDREAM_STATUS_API = 'https://functions.poehali.dev/ffebd367-227e-4e12-a5f1-64db84bddc81';
const HISTORY_API = 'https://functions.poehali.dev/8436b2bf-ae39-4d91-b2b7-91951b4235cd';



export default function ReplicateTryOn() {
  const { user } = useAuth();
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [selectedClothingItems, setSelectedClothingItems] = useState<SelectedClothing[]>([]);
  const [clothingCatalog, setClothingCatalog] = useState<ClothingItem[]>([]);

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
  const [selectedGender, setSelectedGender] = useState<string>('');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [generationStatus, setGenerationStatus] = useState<string>('');

  const [showCropper, setShowCropper] = useState(false);
  const [tempImageForCrop, setTempImageForCrop] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState<string>('');


  useEffect(() => {
    fetchFilters();
    if (user) {
      fetchLookbooks();
    }
  }, [user]);

  useEffect(() => {
    fetchCatalog();
  }, [selectedCategories, selectedColors, selectedArchetypes, selectedGender]);

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
      if (selectedGender) {
        params.append('gender', selectedGender);
      }
      const response = await fetch(`${CATALOG_API}?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        const filteredData = data.filter((item: ClothingItem) => {
          const category = mapCategoryFromCatalog(item);
          return category === 'upper_body' || category === 'lower_body' || category === 'dresses';
        });
        setClothingCatalog(filteredData);
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
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const aspectRatio = img.width / img.height;
            const targetRatio = 3 / 4;
            const tolerance = 0.05;
            
            const isCorrectAspectRatio = Math.abs(aspectRatio - targetRatio) < tolerance;
            
            if (isCorrectAspectRatio) {
              resizeImage(file, 1024, 1024).then(resized => {
                setUploadedImage(resized);
                toast.success('Фото загружено');
              }).catch(error => {
                console.error('Image resize error:', error);
                toast.error('Ошибка обработки изображения');
              });
            } else {
              setTempImageForCrop(event.target?.result as string);
              setShowCropper(true);
            }
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error('Image upload error:', error);
        toast.error('Ошибка загрузки изображения');
      }
    }
  };

  const handleCropComplete = async (croppedImage: string) => {
    try {
      const response = await fetch(croppedImage);
      const blob = await response.blob();
      const file = new File([blob], 'cropped-image.jpg', { type: 'image/jpeg' });
      
      const resized = await resizeImage(file, 1024, 1024);
      setUploadedImage(resized);
      setShowCropper(false);
      setTempImageForCrop(null);
      toast.success('Фото обрезано и загружено');
    } catch (error) {
      console.error('Crop processing error:', error);
      toast.error('Ошибка обработки обрезанного изображения');
    }
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setTempImageForCrop(null);
  };

  const handleCustomClothingUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (selectedClothingItems.length >= 1 && selectedClothingItems[0].category === 'dresses') {
      toast.error('Уже выбран полный образ. Удалите его, если хотите загрузить другую вещь');
      e.target.value = '';
      return;
    }

    const remainingSlots = 2 - selectedClothingItems.length;
    if (remainingSlots <= 0) {
      toast.error('Максимум 2 вещи можно выбрать');
      e.target.value = '';
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      toast.warning(`Можно добавить только ${remainingSlots} вещь(и)`);
    }

    try {
      const resizedImages = await Promise.all(
        filesToProcess.map(async (file) => {
          const resized = await resizeImage(file, 1024, 1024);
          return {
            id: `custom-${Date.now()}-${Math.random()}`,
            image: resized,
            name: file.name,
            category: '',
            isFromCatalog: false,
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
      if (selectedClothingItems.length >= 1 && selectedClothingItems[0].category === 'dresses') {
        toast.error('Уже выбран полный образ. Удалите его, если хотите выбрать другую вещь');
        return;
      }
      
      if (selectedClothingItems.length >= 2) {
        toast.error('Максимум 2 вещи можно выбрать');
        return;
      }
      
      const newCategory = mapCategoryFromCatalog(item);
      if (newCategory === 'dresses' && selectedClothingItems.length > 0) {
        toast.error('Полный образ нельзя комбинировать с другими вещами. Удалите уже выбранные вещи');
        return;
      }
      
      setSelectedClothingItems((prev) => [
        ...prev,
        {
          id: item.id,
          image: item.image_url,
          name: item.name,
          category: newCategory,
          isFromCatalog: true,
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

    if (selectedClothingItems.length > 2) {
      toast.error('Максимум 2 вещи можно выбрать');
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

    if (selectedClothingItems.length === 2) {
      const categories = selectedClothingItems.map(item => item.category);
      const hasUpper = categories.includes('upper_body');
      const hasLower = categories.includes('lower_body');
      
      if (!hasUpper || !hasLower) {
        toast.error('При выборе 2 вещей нужно выбрать одну для верха и одну для низа');
        return;
      }
    }

    const balanceCheck = await checkReplicateBalance(user, selectedClothingItems.length);
    if (!balanceCheck.canGenerate) {
      return;
    }

    const balanceDeducted = await deductReplicateBalance(user, selectedClothingItems.length);
    if (!balanceDeducted) {
      return;
    }

    setIsGenerating(true);
    setGeneratedImage(null);
    setGenerationStatus('Запускаем генерацию...');


    const estimatedTime = selectedClothingItems.length * 20;
    toast.info(`Генерация займёт ~${estimatedTime}-${estimatedTime + 30} секунд. Не закрывайте страницу!`, {
      duration: 6000
    });

    try {
      const response = await fetch(SEEDREAM_START_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': user.id,
        },
        body: JSON.stringify({
          person_image: uploadedImage,
          garments: selectedClothingItems
            .sort((a, b) => {
              const order = { 'upper_body': 0, 'lower_body': 1, 'dresses': 2 };
              return (order[a.category as keyof typeof order] || 99) - (order[b.category as keyof typeof order] || 99);
            })
            .map((item) => ({
              image: item.image,
              category: item.category || 'upper_body',
            })),
          custom_prompt: customPrompt,
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
        const response = await fetch(`${SEEDREAM_STATUS_API}?task_id=${taskId}`);
        if (!response.ok) {
          throw new Error('Ошибка проверки статуса');
        }

        const data = await response.json();
        
        if (data.status === 'pending') {
          setGenerationStatus('В очереди...');
        } else if (data.status === 'processing') {
          setGenerationStatus('Генерация изображения...');
        } else if (data.status === 'completed') {
          setGeneratedImage(data.result_url);
          setIsGenerating(false);
          setGenerationStatus('');
          clearInterval(interval);
          setPollingInterval(null);
          toast.success('Образ готов!');
          
          if (user && uploadedImage && data.result_url) {
            try {
              await fetch(HISTORY_API, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-User-Id': user.id
                },
                body: JSON.stringify({
                  person_image: uploadedImage,
                  garments: selectedClothingItems.map(item => ({ image: item.image, category: item.category })),
                  result_image: data.result_url
                })
              });
            } catch (error) {
              console.error('Failed to save history:', error);
            }
          }
        } else if (data.status === 'failed') {
          setIsGenerating(false);
          setGenerationStatus('');
          toast.error(data.error_message || 'Ошибка генерации');
          clearInterval(interval);
          setPollingInterval(null);
        }
      } catch (error: any) {
        console.error('Polling error:', error);
      }
    }, 3000);

    setPollingInterval(interval);
  };

  const handleReset = () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
    setUploadedImage(null);
    setSelectedClothingItems([]);
    setGeneratedImage(null);
    setTaskId(null);
    setIsGenerating(false);
    setGenerationStatus('');
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
              Виртуальная Примерочная
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Выберите одежду и создайте идеальный образ с помощью AI. Модель умеет естественно переносить одежду на человека
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
                    selectedGender={selectedGender}
                    setSelectedCategories={setSelectedCategories}
                    setSelectedColors={setSelectedColors}
                    setSelectedArchetypes={setSelectedArchetypes}
                    setSelectedGender={setSelectedGender}
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
                        <div className="flex-1">
                          <p className="text-sm font-medium text-blue-900">{generationStatus}</p>
                          <p className="text-xs text-blue-700 mt-1">
                            Не закрывайте страницу до завершения генерации
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="customPrompt" className="text-sm font-medium mb-2 block">
                        Дополнительные детали (опционально)
                      </Label>
                      <Textarea
                        id="customPrompt"
                        placeholder="Опишите фон, освещение, настроение образа... Например: 'студийное освещение, нейтральный фон' или 'уличная съёмка, городской пейзаж'"
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        disabled={isGenerating}
                        className="resize-none"
                        rows={3}
                      />
                    </div>
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
              handleDownloadImage={handleDownloadImage}
              setShowSaveDialog={setShowSaveDialog}
              handleReset={handleReset}
            />
          </div>

          <div className="max-w-5xl mx-auto mt-16 mb-12">
            <h2 className="text-3xl font-bold text-center mb-12">Как пользоваться примерочной</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-purple-100 rounded-full flex items-center justify-center">
                  <Icon name="Upload" className="text-purple-600" size={32} />
                </div>
                <h3 className="text-xl font-semibold mb-2">1. Загрузите фото</h3>
                <p className="text-muted-foreground">
                  Выберите фотографию человека в полный рост
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-purple-100 rounded-full flex items-center justify-center">
                  <Icon name="Shirt" className="text-purple-600" size={32} />
                </div>
                <h3 className="text-xl font-semibold mb-2">2. Выберите вещи</h3>
                <p className="text-muted-foreground">
                  Выберите 1-2 вещи из каталога или загрузите свои фото
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-purple-100 rounded-full flex items-center justify-center">
                  <Icon name="Sparkles" className="text-purple-600" size={32} />
                </div>
                <h3 className="text-xl font-semibold mb-2">3. Получите результат</h3>
                <p className="text-muted-foreground">
                  AI создаст реалистичное изображение с выбранным образом
                </p>
              </div>
            </div>
          </div>

          <div className="max-w-3xl mx-auto mt-16 mb-12">
            <h2 className="text-3xl font-bold text-center mb-8">Часто задаваемые вопросы</h2>
            <Card>
              <CardContent className="p-6">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="item-1">
                    <AccordionTrigger>Какие требования к фотографии?</AccordionTrigger>
                    <AccordionContent>
                      Лучше всего использовать фотографии в полный рост с хорошим освещением. 
                      Человек должен быть хорошо виден, без сильных искажений. 
                      Рекомендуем вертикальный формат фото (высота больше ширины).
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-2">
                    <AccordionTrigger>Сколько вещей можно примерить одновременно?</AccordionTrigger>
                    <AccordionContent>
                      Вы можете выбрать одну вещь любой категории (топы, рубашки, жакеты, брюки, юбки, платья) 
                      или две вещи разных категорий: одну для верха (топы, рубашки, жакеты) и одну для низа (брюки, юбки, шорты).
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-3">
                    <AccordionTrigger>Как работает технология?</AccordionTrigger>
                    <AccordionContent>
                      Мы используем нейросеть IDM-VTON, которая анализирует фото человека и одежды, 
                      затем создаёт реалистичное изображение, где человек одет в выбранные вещи. 
                      Технология учитывает позу, освещение и форму тела. При выборе двух вещей сначала 
                      надевается верх, затем низ.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-4">
                    <AccordionTrigger>Можно ли использовать свою одежду?</AccordionTrigger>
                    <AccordionContent>
                      Да! Вы можете загрузить фото своей одежды через кнопку "Загрузить свою вещь". 
                      Лучше всего использовать фото на белом фоне или на модели.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-5">
                    <AccordionTrigger>Что делать, если результат неточный?</AccordionTrigger>
                    <AccordionContent>
                      Попробуйте использовать другое фото модели или одежды. 
                      Лучшие результаты получаются на фото с хорошим освещением, 
                      где человек стоит прямо и хорошо видна вся фигура.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-6">
                    <AccordionTrigger>Сколько времени занимает генерация?</AccordionTrigger>
                    <AccordionContent>
                      Генерация обычно занимает 20-30 секунд для одной вещи и 40-60 секунд для двух вещей. 
                      Время может увеличиться в зависимости от нагрузки на серверы. При выборе двух вещей 
                      вы увидите промежуточный результат после первой вещи.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </div>
          
          <div className="text-center mt-8 pb-4">
            <p className="text-xs text-muted-foreground">
              Powered by{' '}
              <a 
                href="https://replicate.com/cuuupid/idm-vton" 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline hover:text-primary transition-colors"
              >
                IDM-VTON
              </a>
              {' '}(CC BY 4.0)
            </p>
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

      {tempImageForCrop && (
        <ImageCropper
          image={tempImageForCrop}
          open={showCropper}
          onClose={handleCropCancel}
          onCropComplete={handleCropComplete}
          aspectRatio={3 / 4}
        />
      )}
    </Layout>
  );
}