import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { Link } from 'react-router-dom';
import TryOnHeader from '@/components/replicate/TryOnHeader';
import TryOnImageUploadSection from '@/components/replicate/TryOnImageUploadSection';
import TryOnClothingSection from '@/components/replicate/TryOnClothingSection';
import TryOnControlsSection from '@/components/replicate/TryOnControlsSection';
import ReplicateImageUpload from '@/components/replicate/ReplicateImageUpload';
import ReplicateClothingSelector from '@/components/replicate/ReplicateClothingSelector';
import ReplicateResultPanel from '@/components/replicate/ReplicateResultPanel';
import ReplicateSaveDialog from '@/components/replicate/ReplicateSaveDialog';
import ImageCropper from '@/components/ImageCropper';
import { checkReplicateBalance, deductReplicateBalance, refundReplicateBalance } from '@/utils/replicateBalanceUtils';
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
  const [userBalance, setUserBalance] = useState<number>(0);
  const isNanoBananaRequestInProgress = useRef(false);

  useEffect(() => {
    fetchFilters();
    if (user) {
      fetchLookbooks();
      fetchUserBalance();
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

  const fetchUserBalance = async () => {
    if (!user) return;
    const balanceCheck = await checkReplicateBalance(user.id, 0);
    setUserBalance(balanceCheck.balance);
  };

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
      taskId,
      intermediateResult
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
      intermediateResult
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
      intermediateResult
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
        <TryOnHeader />

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <TryOnImageUploadSection>
            <ReplicateImageUpload
              uploadedImage={uploadedImage}
              onImageUpload={handlePersonImageUpload}
              onImageRemove={() => setUploadedImage(null)}
            />
          </TryOnImageUploadSection>

          <TryOnClothingSection>
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
          </TryOnClothingSection>
        </div>

        <TryOnControlsSection>
          <ReplicateGenerationControls
            activeFittingRoom={activeFittingRoom}
            setActiveFittingRoom={setActiveFittingRoom}
            customPrompt={customPrompt}
            setCustomPrompt={setCustomPrompt}
            isGenerating={isGenerating}
            canGenerate={!!canGenerate}
            onGenerate={handleGenerate}
            generationStatus={generationStatus}
            waitingContinue={waitingContinue}
            onContinueGeneration={handleContinueGeneration}
            onCancelGeneration={handleCancelGeneration}
          />
        </TryOnControlsSection>

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

        <ReplicateBalanceCheck
          showBalanceModal={showBalanceModal}
          setShowBalanceModal={setShowBalanceModal}
          requiredBalance={userBalance}
          activeFittingRoom={activeFittingRoom}
        />

        <Dialog open={showCategoryError} onOpenChange={setShowCategoryError}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Несовместимые категории одежды</DialogTitle>
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