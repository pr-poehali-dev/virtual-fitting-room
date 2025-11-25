import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';
import VirtualFittingControls from '@/components/VirtualFittingControls';
import VirtualFittingResult from '@/components/VirtualFittingResult';
import VirtualFittingInfo from '@/components/VirtualFittingInfo';

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

const CATALOG_API = 'https://functions.poehali.dev/e65f7df8-0a43-4921-8dbd-3dc0587255cc';

export default function Index() {
  const { user } = useAuth();
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [selectedClothing, setSelectedClothing] = useState<SelectedClothing | null>(null);
  const [clothingCatalog, setClothingCatalog] = useState<ClothingItem[]>([]);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [selectedColors, setSelectedColors] = useState<number[]>([]);
  const [selectedArchetypes, setSelectedArchetypes] = useState<number[]>([]);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [lookbooks, setLookbooks] = useState<any[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newLookbookName, setNewLookbookName] = useState('');
  const [newLookbookPersonName, setNewLookbookPersonName] = useState('');
  const [selectedLookbookId, setSelectedLookbookId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const pendingGeneration = localStorage.getItem('pendingGeneration');
    if (pendingGeneration) {
      const data = JSON.parse(pendingGeneration);
      setUploadedImage(data.uploadedImage);
      setIsGenerating(true);
      continuePolling(data.statusUrl, data.uploadedImage, data.garmentImage);
    }

    if (user) {
      fetchLookbooks();
    }
    
    fetchFilters();
    fetchCatalog();
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
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const id = `custom-${Date.now()}`;
      setSelectedClothing({
        id,
        image: reader.result as string,
        name: file.name,
        categories: []
      });
    };
    reader.readAsDataURL(file);
    
    e.target.value = '';
  };

  const handleCancelGeneration = () => {
    if (abortController) {
      abortController.abort();
      setIsGenerating(false);
      setLoadingProgress(0);
      setAbortController(null);
      localStorage.removeItem('pendingGeneration');
    }
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
      link.download = `virtual-fitting-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Изображение скачано!');
    } catch (error) {
      toast.error('Ошибка скачивания');
    }
  };

  const handleReset = () => {
    setUploadedImage(null);
    setSelectedClothing(null);
    setGeneratedImage(null);
    localStorage.removeItem('pendingGeneration');
  };
  
  const toggleClothingSelection = (item: ClothingItem) => {
    if (selectedClothing?.id === item.id) {
      setSelectedClothing(null);
    } else {
      setSelectedClothing({
        id: item.id,
        image: item.image_url,
        name: item.name,
        categories: item.categories
      });
    }
  };

  const continuePolling = async (statusUrl: string, personImage: string, garmentImg: string) => {
    let checkCount = 0;
    const maxChecks = 120;
    
    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 10;
      });
    }, 1000);

    const checkStatus = async (): Promise<void> => {
      if (checkCount >= maxChecks) {
        clearInterval(progressInterval);
        localStorage.removeItem('pendingGeneration');
        toast.error('Превышено время ожидания');
        setIsGenerating(false);
        return;
      }
      
      checkCount++;
      
      try {
        const statusResponse = await fetch(
          `https://functions.poehali.dev/87fa03b9-724d-4af9-85a2-dda57f503885?status_url=${encodeURIComponent(statusUrl)}`
        );
        
        if (!statusResponse.ok) {
          console.warn('Status check failed, retrying...', statusResponse.status);
          setTimeout(() => checkStatus(), 2000);
          return;
        }
        
        const statusData = await statusResponse.json();
        console.log('Status check #' + checkCount + ':', statusData);
        
        if (statusData.status === 'COMPLETED') {
          clearInterval(progressInterval);
          setLoadingProgress(100);
          setGeneratedImage(statusData.image_url);
          localStorage.removeItem('pendingGeneration');
          toast.success('Изображение успешно сгенерировано!');
          setIsGenerating(false);
          
          if (user) {
            try {
              await fetch('https://functions.poehali.dev/8436b2bf-ae39-4d91-b2b7-91951b4235cd', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-User-Id': user.id
                },
                body: JSON.stringify({
                  person_image: personImage,
                  garment_image: garmentImg,
                  result_image: statusData.image_url
                })
              });
            } catch (historyError) {
              console.warn('Failed to save to history:', historyError);
            }
          }
          
          return;
        }
        
        if (statusData.status === 'FAILED') {
          clearInterval(progressInterval);
          localStorage.removeItem('pendingGeneration');
          toast.error(statusData.error || 'Ошибка генерации');
          setIsGenerating(false);
          return;
        }
        
        setTimeout(() => checkStatus(), 2000);
      } catch (fetchError) {
        console.warn('Fetch error during status check, retrying...', fetchError);
        setTimeout(() => checkStatus(), 2000);
      }
    };
    
    await checkStatus();
  };

  const handleGenerate = async () => {
    if (!user) {
      toast.error('Для генерации изображений необходимо войти в аккаунт');
      return;
    }

    if (!uploadedImage) {
      toast.error('Загрузите фотографию человека');
      return;
    }

    if (!selectedClothing) {
      toast.error('Выберите или загрузите одежду');
      return;
    }

    try {
      const balanceCheck = await fetch('https://functions.poehali.dev/68409278-10ab-4733-b48d-b1b4360620a1', {
        headers: {
          'X-User-Id': user.id
        }
      });

      if (balanceCheck.ok) {
        const balanceData = await balanceCheck.json();
        
        if (!balanceData.can_generate) {
          toast.error('Недостаточно средств. Пополните баланс в личном кабинете.');
          return;
        }
      }

      const deductResponse = await fetch('https://functions.poehali.dev/68409278-10ab-4733-b48d-b1b4360620a1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': user.id
        },
        body: JSON.stringify({
          action: 'deduct'
        })
      });

      if (!deductResponse.ok) {
        const errorData = await deductResponse.json();
        toast.error(errorData.error || 'Ошибка списания средств');
        return;
      }

      const deductData = await deductResponse.json();
      
      if (deductData.free_try) {
        toast.info(`Бесплатная примерка! Осталось: ${deductData.remaining_free}`);
      } else if (deductData.paid_try) {
        toast.info(`Списано 25₽. Баланс: ${deductData.new_balance.toFixed(2)}₽`);
      } else if (deductData.unlimited) {
        toast.info('Безлимитный доступ активен');
      }

    } catch (error) {
      toast.error('Ошибка проверки баланса');
      return;
    }

    const controller = new AbortController();
    setAbortController(controller);
    setIsGenerating(true);
    setLoadingProgress(0);
    
    try {
      toast.info('Начинаем примерку...', { duration: 2000 });
      
      const requestBody: any = {
        person_image: uploadedImage,
        garment_image: selectedClothing.image,
        description: `${selectedClothing.name || 'garment'}, photorealistic, natural fit`,
        category_hint: selectedClothing.categories[0] || 'clothing'
      };
      
      const submitResponse = await fetch('https://functions.poehali.dev/87fa03b9-724d-4af9-85a2-dda57f503885', {
        signal: controller.signal,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const submitData = await submitResponse.json();
      
      if (!submitResponse.ok) {
        throw new Error(submitData.error || 'Failed to submit generation');
      }
      
      const statusUrl = submitData.status_url;
      
      if (!statusUrl) {
        throw new Error('No status URL returned');
      }

      let checkCount = 0;
      const maxChecks = 120;
      
      const waitForCompletion = async (): Promise<string> => {
        return new Promise(async (resolve, reject) => {
          const checkStatus = async () => {
            if (checkCount >= maxChecks) {
              reject(new Error('Превышено время ожидания'));
              return;
            }
            
            checkCount++;
            setLoadingProgress(Math.min((checkCount / maxChecks) * 100, 95));
            
            try {
              const statusResponse = await fetch(
                `https://functions.poehali.dev/87fa03b9-724d-4af9-85a2-dda57f503885?status_url=${encodeURIComponent(statusUrl)}`
              );
              
              if (!statusResponse.ok) {
                setTimeout(checkStatus, 2000);
                return;
              }
              
              const statusData = await statusResponse.json();
              
              if (statusData.status === 'COMPLETED') {
                resolve(statusData.image_url);
                return;
              }
              
              if (statusData.status === 'FAILED') {
                reject(new Error(statusData.error || 'Ошибка генерации'));
                return;
              }
              
              setTimeout(checkStatus, 2000);
            } catch (error) {
              setTimeout(checkStatus, 2000);
            }
          };
          
          await checkStatus();
        });
      };
      
      const resultImageUrl = await waitForCompletion();
      
      setLoadingProgress(100);
      setGeneratedImage(resultImageUrl);
      toast.success('Примерка завершена!');
      setIsGenerating(false);
      
      if (user) {
        try {
          const response = await fetch('https://functions.poehali.dev/8436b2bf-ae39-4d91-b2b7-91951b4235cd', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-User-Id': user.id
            },
            body: JSON.stringify({
              person_image: uploadedImage,
              garment_image: selectedClothing.image,
              result_image: resultImageUrl
            })
          });
          if (!response.ok) {
            console.error('Failed to save history:', response.status, await response.text());
          }
        } catch (historyError) {
          console.error('Failed to save to history:', historyError);
        }
      }
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        toast.info('Генерация отменена');
      } else {
        toast.error(error instanceof Error ? error.message : 'Ошибка генерации');
      }
      setIsGenerating(false);
      setLoadingProgress(0);
      setAbortController(null);
    }
  };

  return (
    <Layout>
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-5xl md:text-6xl font-light mb-4">
              Виртуальная примерочная
            </h2>
            <p className="text-muted-foreground text-lg">
              Примерьте одежду онлайн с помощью AI технологий
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-start">
            <VirtualFittingControls
              uploadedImage={uploadedImage}
              handleImageUpload={handleImageUpload}
              selectedClothing={selectedClothing}
              clothingCatalog={clothingCatalog}
              filters={filters}
              selectedCategories={selectedCategories}
              selectedColors={selectedColors}
              selectedArchetypes={selectedArchetypes}
              setSelectedCategories={setSelectedCategories}
              setSelectedColors={setSelectedColors}
              setSelectedArchetypes={setSelectedArchetypes}
              toggleClothingSelection={toggleClothingSelection}
              setSelectedClothing={setSelectedClothing}
              handleCustomClothingUpload={handleCustomClothingUpload}
              handleGenerate={handleGenerate}
              isGenerating={isGenerating}
              loadingProgress={loadingProgress}
              handleCancelGeneration={handleCancelGeneration}
            />

            <VirtualFittingResult
              isGenerating={isGenerating}
              generatedImage={generatedImage}
              loadingProgress={loadingProgress}
              handleDownloadImage={handleDownloadImage}
              user={user}
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
              handleReset={handleReset}
            />
          </div>
        </div>
      </section>

      <VirtualFittingInfo />
    </Layout>
  );
}