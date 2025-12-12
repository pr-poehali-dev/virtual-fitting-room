import { useState, useEffect, useRef } from 'react';
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
import { resizeImage } from '@/utils/replicateImageUtils';
import { mapCategoryFromCatalog } from '@/utils/replicateCategoryMapping';
import { startGeneration, continueGeneration, cancelGeneration } from '@/utils/replicateGenerationLogic';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
  const [intermediateResult, setIntermediateResult] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [totalSteps, setTotalSteps] = useState<number>(0);
  const [waitingContinue, setWaitingContinue] = useState<boolean>(false);
  const [checkerInterval, setCheckerInterval] = useState<NodeJS.Timeout | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [tempImageForCrop, setTempImageForCrop] = useState<string | null>(null);
  const [activeFittingRoom, setActiveFittingRoom] = useState<'replicate' | 'seedream' | 'nanobananapro'>('replicate');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [showCategoryError, setShowCategoryError] = useState(false);
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const isNanoBananaRequestInProgress = useRef(false);

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
      if (checkerInterval) {
        clearInterval(checkerInterval);
      }
    };
  }, [pollingInterval, checkerInterval]);

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

  const handlePersonImageUpload = async (file: File) => {
    try {
      const resizedImage = await resizeImage(file, 1024, 1024);
      setTempImageForCrop(resizedImage);
      setShowCropper(true);
    } catch (error) {
      console.error('Image upload error:', error);
      toast.error('Ошибка загрузки изображения');
    }
  };

  const handleCropComplete = (croppedImage: string) => {
    setUploadedImage(croppedImage);
    setShowCropper(false);
    setTempImageForCrop(null);
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setTempImageForCrop(null);
  };

  const handleClothingImageUpload = async (file: File) => {
    try {
      const resizedImage = await resizeImage(file, 1024, 1024);
      const newItem: SelectedClothing = {
        id: `custom-${Date.now()}`,
        image: resizedImage,
        name: file.name,
        category: 'upper_body',
        isFromCatalog: false
      };
      setSelectedClothingItems([...selectedClothingItems, newItem]);
    } catch (error) {
      console.error('Clothing upload error:', error);
      toast.error('Ошибка загрузки одежды');
    }
  };

  const handleSelectFromCatalog = (item: ClothingItem) => {
    const category = mapCategoryFromCatalog(item);
    const newItem: SelectedClothing = {
      id: item.id,
      image: item.image_url,
      name: item.name,
      category: category,
      isFromCatalog: true
    };
    setSelectedClothingItems([...selectedClothingItems, newItem]);
  };

  const handleRemoveClothing = (id: string) => {
    setSelectedClothingItems(selectedClothingItems.filter(item => item.id !== id));
  };

  const handleUpdateClothingCategory = (id: string, category: string) => {
    setSelectedClothingItems(
      selectedClothingItems.map(item =>
        item.id === id ? { ...item, category } : item
      )
    );
  };

  const handleGenerate = () => {
    startGeneration({
      user,
      uploadedImage,
      selectedClothingItems,
      activeFittingRoom,
      customPrompt,
      setIsGenerating,
      setGenerationStatus,
      setTaskId,
      setPollingInterval,
      setGeneratedImage,
      setIntermediateResult,
      setCurrentStep,
      setTotalSteps,
      setWaitingContinue,
      setCheckerInterval,
      setShowBalanceModal,
      isNanoBananaRequestInProgress,
      setShowCategoryError,
    });
  };

  const handleContinueGeneration = () => {
    continueGeneration({
      user,
      uploadedImage,
      selectedClothingItems,
      activeFittingRoom,
      customPrompt,
      setIsGenerating,
      setGenerationStatus,
      setTaskId,
      setPollingInterval,
      setGeneratedImage,
      setIntermediateResult,
      setCurrentStep,
      setTotalSteps,
      setWaitingContinue,
      setCheckerInterval,
      setShowBalanceModal,
      isNanoBananaRequestInProgress,
      setShowCategoryError,
      taskId,
    });
  };

  const handleCancelGeneration = () => {
    cancelGeneration({
      user,
      uploadedImage,
      selectedClothingItems,
      activeFittingRoom,
      customPrompt,
      setIsGenerating,
      setGenerationStatus,
      setTaskId,
      setPollingInterval,
      setGeneratedImage,
      setIntermediateResult,
      setCurrentStep,
      setTotalSteps,
      setWaitingContinue,
      setCheckerInterval,
      setShowBalanceModal,
      isNanoBananaRequestInProgress,
      setShowCategoryError,
      taskId,
    });
  };

  const handleSaveToLookbook = async () => {
    if (!generatedImage || !user) return;

    setIsSaving(true);

    try {
      if (selectedLookbookId === 'new') {
        if (!newLookbookName || !newLookbookPersonName) {
          toast.error('Заполните все поля');
          setIsSaving(false);
          return;
        }

        const createResponse = await fetch('https://functions.poehali.dev/69de81d7-5596-4e1d-bbd3-4b3e1a520d6b', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': user.id
          },
          body: JSON.stringify({
            name: newLookbookName,
            person_name: newLookbookPersonName,
            photos: [generatedImage]
          })
        });

        if (!createResponse.ok) {
          throw new Error('Failed to create lookbook');
        }

        toast.success('Лукбук создан и фото сохранено!');
      } else {
        const lookbook = lookbooks.find(lb => lb.id === selectedLookbookId);
        if (!lookbook) {
          toast.error('Лукбук не найден');
          setIsSaving(false);
          return;
        }

        const updatedPhotos = [...(lookbook.photos || []), generatedImage];

        const updateResponse = await fetch('https://functions.poehali.dev/69de81d7-5596-4e1d-bbd3-4b3e1a520d6b', {
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

        if (!updateResponse.ok) {
          throw new Error('Failed to update lookbook');
        }

        toast.success('Фото добавлено в лукбук!');
      }

      setShowSaveDialog(false);
      setNewLookbookName('');
      setNewLookbookPersonName('');
      setSelectedLookbookId('');
      await fetchLookbooks();

    } catch (error) {
      console.error('Save error:', error);
      toast.error('Ошибка сохранения');
    } finally {
      setIsSaving(false);
    }
  };

  const canGenerate = uploadedImage && selectedClothingItems.length > 0 && user;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-6">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <Icon name="ArrowLeft" size={16} className="mr-2" />
                Назад
              </Button>
            </Link>
            <h1 className="text-3xl font-bold text-white">Виртуальная примерочная</h1>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <Card className="border-gray-700 bg-gray-800">
            <CardContent className="pt-6">
              <Label className="text-lg font-semibold mb-4 block text-white">
                Загрузите фото модели
              </Label>
              <ReplicateImageUpload
                uploadedImage={uploadedImage}
                onImageUpload={handlePersonImageUpload}
                onImageRemove={() => setUploadedImage(null)}
              />
            </CardContent>
          </Card>

          <Card className="border-gray-700 bg-gray-800">
            <CardContent className="pt-6">
              <Label className="text-lg font-semibold mb-4 block text-white">
                Выберите одежду
              </Label>
              <ReplicateClothingSelector
                selectedClothingItems={selectedClothingItems}
                onClothingUpload={handleClothingImageUpload}
                onRemoveClothing={handleRemoveClothing}
                onUpdateCategory={handleUpdateClothingCategory}
                onSelectFromCatalog={handleSelectFromCatalog}
                clothingCatalog={clothingCatalog}
                filters={filters}
                selectedCategories={selectedCategories}
                setSelectedCategories={setSelectedCategories}
                selectedColors={selectedColors}
                setSelectedColors={setSelectedColors}
                selectedArchetypes={selectedArchetypes}
                setSelectedArchetypes={setSelectedArchetypes}
                selectedGender={selectedGender}
                setSelectedGender={setSelectedGender}
              />
            </CardContent>
          </Card>
        </div>

        <Card className="border-gray-700 bg-gray-800 mb-6">
          <CardContent className="pt-6 space-y-4">
            <div className="flex gap-2">
              <Button
                variant={activeFittingRoom === 'replicate' ? 'default' : 'outline'}
                onClick={() => setActiveFittingRoom('replicate')}
                disabled={isGenerating}
                size="sm"
              >
                Replicate (6₽)
              </Button>
              <Button
                variant={activeFittingRoom === 'seedream' ? 'default' : 'outline'}
                onClick={() => setActiveFittingRoom('seedream')}
                disabled={isGenerating}
                size="sm"
              >
                SeeDream (3₽)
              </Button>
              <Button
                variant={activeFittingRoom === 'nanobananapro' ? 'default' : 'outline'}
                onClick={() => setActiveFittingRoom('nanobananapro')}
                disabled={isGenerating}
                size="sm"
              >
                NanoBanana Pro (3₽)
              </Button>
            </div>

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="prompt" className="border-gray-600">
                <AccordionTrigger className="text-white hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Icon name="Wand2" size={18} />
                    <span>Дополнительные настройки (необязательно)</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pt-2">
                    <Label className="text-gray-300">Кастомный промпт</Label>
                    <Textarea
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="Например: professional photoshoot, studio lighting..."
                      className="min-h-[80px] bg-gray-700 border-gray-600 text-white"
                      disabled={isGenerating}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Button 
              onClick={handleGenerate}
              disabled={isGenerating || !canGenerate}
              size="lg"
              className="w-full text-lg py-6"
            >
              {isGenerating ? (
                <>
                  <Icon name="Loader2" className="mr-2 h-5 w-5 animate-spin" />
                  {generationStatus || 'Генерация...'}
                  {totalSteps > 0 && ` (${currentStep}/${totalSteps})`}
                </>
              ) : (
                <>
                  <Icon name="Sparkles" className="mr-2 h-5 w-5" />
                  Примерить
                </>
              )}
            </Button>

            {waitingContinue && intermediateResult && (
              <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-start gap-2">
                  <Icon name="Info" className="text-blue-600 flex-shrink-0 mt-1" size={20} />
                  <div className="space-y-2 flex-1">
                    <p className="text-sm font-medium text-blue-900">
                      Промежуточный результат готов
                    </p>
                    <p className="text-sm text-blue-700">
                      Вы можете принять текущий результат или продолжить улучшение изображения
                    </p>
                    <div className="flex gap-2 mt-3">
                      <Button
                        onClick={() => {
                          setGeneratedImage(intermediateResult);
                          setIntermediateResult(null);
                          setWaitingContinue(false);
                          setIsGenerating(false);
                          setGenerationStatus('');
                        }}
                        variant="default"
                        size="sm"
                      >
                        Принять результат
                      </Button>
                      <Button
                        onClick={handleContinueGeneration}
                        variant="outline"
                        size="sm"
                      >
                        Продолжить улучшение
                      </Button>
                      <Button
                        onClick={handleCancelGeneration}
                        variant="outline"
                        size="sm"
                      >
                        Отменить
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <img 
                    src={intermediateResult} 
                    alt="Промежуточный результат" 
                    className="w-full rounded-lg border border-blue-200"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {(generatedImage || intermediateResult) && (
          <Card className="border-gray-700 bg-gray-800 mt-6">
            <CardContent className="p-6">
              <ReplicateResultPanel
                generatedImage={generatedImage}
                intermediateResult={intermediateResult}
                currentStep={currentStep}
                totalSteps={totalSteps}
                onSave={() => setShowSaveDialog(true)}
                isLoggedIn={!!user}
              />
            </CardContent>
          </Card>
        )}

        {!user && (
          <Card className="border-gray-700 bg-gray-800/50 mt-6">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Icon name="Info" size={24} className="text-blue-400" />
                <div className="flex-1">
                  <p className="text-white font-medium mb-1">Требуется авторизация</p>
                  <p className="text-gray-300 text-sm">
                    Войдите в аккаунт, чтобы сохранять результаты в лукбуки
                  </p>
                </div>
                <Button asChild>
                  <Link to="/login">
                    <Icon name="LogIn" className="mr-2" size={16} />
                    Войти
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <ReplicateSaveDialog
          open={showSaveDialog}
          onClose={() => {
            setShowSaveDialog(false);
            setNewLookbookName('');
            setNewLookbookPersonName('');
            setSelectedLookbookId('');
          }}
          lookbooks={lookbooks}
          selectedLookbookId={selectedLookbookId}
          setSelectedLookbookId={setSelectedLookbookId}
          newLookbookName={newLookbookName}
          setNewLookbookName={setNewLookbookName}
          newLookbookPersonName={newLookbookPersonName}
          setNewLookbookPersonName={setNewLookbookPersonName}
          onSave={handleSaveToLookbook}
          isSaving={isSaving}
        />

        <Dialog open={showBalanceModal} onOpenChange={setShowBalanceModal}>
          <DialogContent className="bg-gray-800 border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-white">Недостаточно средств</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-gray-300">
                Для генерации с {activeFittingRoom === 'replicate' ? 'Replicate (6₽)' : 'SeeDream/NanoBanana (3₽)'} необходимо пополнить баланс.
              </p>
              <Button asChild className="w-full">
                <Link to="/profile">
                  Пополнить баланс
                </Link>
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={showCategoryError} onOpenChange={setShowCategoryError}>
          <DialogContent className="bg-gray-800 border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-white">Несовместимые категории одежды</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-gray-300">
                Нельзя одновременно примерять платье и отдельные верхнюю/нижнюю одежду.
              </p>
              <p className="text-gray-300">
                Пожалуйста, выберите либо платье, либо комбинацию из верхней и нижней одежды.
              </p>
              <Button onClick={() => setShowCategoryError(false)} className="w-full">
                Понятно
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {showCropper && tempImageForCrop && (
          <ImageCropper
            image={tempImageForCrop}
            onCropComplete={handleCropComplete}
            onCancel={handleCropCancel}
            aspectRatio={3 / 4}
          />
        )}
      </div>
    </Layout>
  );
}
