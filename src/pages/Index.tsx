import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';

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

const CATALOG_API = 'https://functions.poehali.dev/e65f7df8-0a43-4921-8dbd-3dc0587255cc';
const IMAGE_COMPOSER_API = 'https://functions.poehali.dev/021a040a-aa04-40b9-86e3-77547b31401b';
const IMAGE_PREPROCESSING_API = 'https://functions.poehali.dev/3fe8c892-ab5f-4d26-a2c5-ae4166276334';

export default function Index() {
  const { user } = useAuth();
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [selectedClothingItems, setSelectedClothingItems] = useState<SelectedClothing[]>([]);
  const [customClothingImage, setCustomClothingImage] = useState<string | null>(null);
  const [customClothingItems, setCustomClothingItems] = useState<SelectedClothing[]>([]);
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
  const [processingImages, setProcessingImages] = useState<Set<string>>(new Set());

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
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newItem: SelectedClothing = {
          id: `custom-${Date.now()}-${Math.random()}`,
          image: reader.result as string,
          comment: '',
          categories: []
        };
        setCustomClothingItems(prev => [...prev, newItem]);
      };
      reader.readAsDataURL(file);
    });
    
    e.target.value = '';
  };
  
  const updateCustomClothingCategory = (id: string, category: string) => {
    setCustomClothingItems(customClothingItems.map(item =>
      item.id === id ? { ...item, categories: [category] } : item
    ));
  };
  
  const updateCustomClothingComment = (id: string, comment: string) => {
    setCustomClothingItems(customClothingItems.map(item =>
      item.id === id ? { ...item, comment } : item
    ));
  };
  
  const removeCustomClothing = (id: string) => {
    setCustomClothingItems(customClothingItems.filter(item => item.id !== id));
  };
  
  const processImageBackground = async (imageUrl: string, itemId: string): Promise<string> => {
    setProcessingImages(prev => new Set(prev).add(itemId));
    console.log(`[BG Removal] Starting for item ${itemId}, image type: ${imageUrl.startsWith('data:') ? 'base64' : 'URL'}`);
    toast.info('Удаляем фон с изображения...', { duration: 2000 });
    
    try {
      const response = await fetch(IMAGE_PREPROCESSING_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_url: imageUrl
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[BG Removal] Failed for ${itemId}:`, response.status, errorText);
        throw new Error(`Failed to process image: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`[BG Removal] Success for ${itemId}:`, {
        original: imageUrl.substring(0, 100),
        processed: data.processed_image?.substring(0, 100),
        hasProcessed: !!data.processed_image
      });
      
      setProcessingImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
      
      if (!data.processed_image) {
        console.warn(`[BG Removal] No processed_image in response for ${itemId}, using original`);
        toast.warning('Фон не удалось обработать, используем оригинал');
        return imageUrl;
      }
      
      toast.success('Фон удалён!', { duration: 2000 });
      return data.processed_image;
    } catch (error) {
      console.error(`[BG Removal] Error for ${itemId}:`, error);
      setProcessingImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
      toast.error('Не удалось обработать изображение, используем оригинал');
      return imageUrl; // Return original if processing fails
    }
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
    setSelectedClothingItems([]);
    setCustomClothingImage(null);
    setCustomClothingItems([]);
    setGeneratedImage(null);
    localStorage.removeItem('pendingGeneration');
  };
  
  const toggleClothingSelection = (item: ClothingItem) => {
    const existing = selectedClothingItems.find(c => c.id === item.id);
    if (existing) {
      setSelectedClothingItems(selectedClothingItems.filter(c => c.id !== item.id));
    } else {
      setSelectedClothingItems([...selectedClothingItems, {
        id: item.id,
        image: item.image_url,
        comment: '',
        categories: item.categories
      }]);
    }
  };
  
  const updateClothingComment = (id: string, comment: string) => {
    setSelectedClothingItems(selectedClothingItems.map(item =>
      item.id === id ? { ...item, comment } : item
    ));
  };
  
  const toggleFilter = (array: number[], value: number) => {
    return array.includes(value)
      ? array.filter(v => v !== value)
      : [...array, value];
  };
  
  const getCategoryPlacementHint = (categories: string[]): string => {
    if (!categories || categories.length === 0) return 'clothing item';
    
    const categoryLower = categories.map(c => c.toLowerCase());
    
    // Полные образы - первыми
    if (categoryLower.some(c => c.includes('весь образ') || c.includes('full outfit') || c.includes('complete look'))) {
      return 'complete outfit';
    }
    
    // Платья - вторыми
    if (categoryLower.some(c => c.includes('платье') || c.includes('dress'))) {
      return 'dress';
    }
    
    // Топы/блузки - третьими
    if (categoryLower.some(c => c.includes('топ') || c.includes('блузка') || c.includes('блуза') || c.includes('футболка') || c.includes('рубашка') || c.includes('top') || c.includes('blouse') || c.includes('shirt') || c.includes('t-shirt'))) {
      return 'top';
    }
    
    // Низ (брюки/юбки) - четвёртыми
    if (categoryLower.some(c => c.includes('брюки') || c.includes('джинсы') || c.includes('штаны') || c.includes('pants') || c.includes('trousers') || c.includes('jeans'))) {
      return 'pants';
    }
    if (categoryLower.some(c => c.includes('юбка') || c.includes('skirt'))) {
      return 'skirt';
    }
    
    // Верхняя одежда - пятыми
    if (categoryLower.some(c => c.includes('куртка') || c.includes('пальто') || c.includes('jacket') || c.includes('coat'))) {
      return 'jacket';
    }
    
    // Обувь - шестыми
    if (categoryLower.some(c => c.includes('обувь') || c.includes('туфли') || c.includes('ботинки') || c.includes('сапоги') || c.includes('кроссовки') || c.includes('shoes') || c.includes('boots') || c.includes('sneakers') || c.includes('heels'))) {
      return 'shoes';
    }
    
    // Аксессуары - последними
    if (categoryLower.some(c => c.includes('аксессуар') || c.includes('accessory') || c.includes('шарф') || c.includes('scarf') || c.includes('сумка') || c.includes('bag') || c.includes('украшение') || c.includes('jewelry'))) {
      return 'accessory';
    }
    
    return categories[0].toLowerCase();
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
    if (!uploadedImage) {
      toast.error('Загрузите фотографию человека');
      return;
    }

    // Объединяем элементы из каталога и кастомные загруженные
    const customItemsWithCategory = customClothingItems.filter(item => item.categories && item.categories.length > 0);
    const allClothingItems = [...selectedClothingItems, ...customItemsWithCategory];
    
    if (allClothingItems.length === 0) {
      toast.error('Выберите или загрузите одежду');
      return;
    }
    
    // Проверяем, что у всех кастомных элементов указана категория
    const customItemsWithoutCategory = customClothingItems.filter(item => !item.categories || item.categories.length === 0);
    if (customItemsWithoutCategory.length > 0) {
      toast.error('Укажите категорию для всех загруженных элементов одежды');
      return;
    }
    
    // Последовательная генерация для нескольких элементов
    console.log('=== GENERATION START ===');
    console.log('Total items:', allClothingItems.length);
    console.log('Items BEFORE sorting:', allClothingItems.map((item, idx) => ({
      index: idx,
      id: item.id,
      categories: item.categories,
      categoriesRaw: JSON.stringify(item.categories),
      detectedType: getCategoryPlacementHint(item.categories),
      comment: item.comment,
      imagePreview: item.image.substring(0, 100)
    })));

    // Сортируем элементы для правильного порядка примерки:
    // 1. Полные образы (complete outfit)
    // 2. Платья (dress)
    // 3. Топы/блузки (top)
    // 4. Низ - брюки/юбки (pants/skirt)
    // 5. Куртки/пальто (jacket)
    // 6. Обувь (shoes)
    // 7. Аксессуары (accessory)
    const sortedItems = [...allClothingItems].sort((a, b) => {
      const getOrder = (categories: string[]) => {
        const hint = getCategoryPlacementHint(categories);
        console.log(`Determining order for categories ${JSON.stringify(categories)}: hint="${hint}"`);
        if (hint.includes('complete outfit')) return 1;
        if (hint.includes('dress')) return 2;
        if (hint.includes('top') || hint.includes('blouse') || hint.includes('shirt')) return 3;
        if (hint.includes('pants') || hint.includes('skirt')) return 4;
        if (hint.includes('jacket') || hint.includes('coat')) return 5;
        if (hint.includes('shoes')) return 6;
        if (hint.includes('accessory')) return 7;
        console.log(`No match found for hint "${hint}", defaulting to order 8`);
        return 8;
      };
      const orderA = getOrder(a.categories);
      const orderB = getOrder(b.categories);
      console.log(`Compare: ${JSON.stringify(a.categories)} (order ${orderA}) vs ${JSON.stringify(b.categories)} (order ${orderB})`);
      return orderA - orderB;
    });
    
    console.log('Sorted order AFTER:', sortedItems.map((item, idx) => ({
      index: idx,
      categories: item.categories,
      detectedType: getCategoryPlacementHint(item.categories),
      id: item.id
    })));

    const controller = new AbortController();
    setAbortController(controller);
    setIsGenerating(true);
    setLoadingProgress(0);
    
    try {
      let currentPersonImage = uploadedImage;
      
      // Предобрабатываем ВСЕ изображения одежды - удаляем фон
      toast.info('Подготовка изображений одежды (удаление фона)...', { duration: 3000 });
      console.log('=== PREPROCESSING ALL IMAGES ===');
      
      const processedItems = await Promise.all(
        sortedItems.map(async (item, idx) => {
          console.log(`Preprocessing item ${idx + 1}/${sortedItems.length}: ${item.id}`);
          
          // Обрабатываем изображение - удаляем фон
          try {
            const processedImage = await processImageBackground(item.image, `preprocessing-${item.id}`);
            console.log(`Item ${idx + 1} processed successfully`);
            return { ...item, image: processedImage };
          } catch (error) {
            console.warn(`Failed to preprocess item ${idx + 1}, using original:`, error);
            return item; // Если обработка не удалась, используем оригинал
          }
        })
      );
      
      console.log('All images preprocessed');
      toast.success('Изображения подготовлены! Начинаем примерку...', { duration: 2000 });
      
      // Генерируем каждый элемент по очереди в правильном порядке
      for (let i = 0; i < processedItems.length; i++) {
        const item = processedItems[i];
        const categoryHint = getCategoryPlacementHint(item.categories);
        const userComment = item.comment ? ` ${item.comment}` : '';
        
        // Формируем описание с явным указанием типа одежды для модели
        let categoryInstruction = '';
        if (categoryHint.includes('top') || categoryHint.includes('blouse') || categoryHint.includes('shirt')) {
          categoryInstruction = 'upper body garment, top, shirt';
        } else if (categoryHint.includes('pants')) {
          categoryInstruction = 'lower body garment, pants, trousers';
        } else if (categoryHint.includes('skirt')) {
          categoryInstruction = 'lower body garment, skirt';
        } else if (categoryHint.includes('dress')) {
          categoryInstruction = 'full body garment, dress';
        } else if (categoryHint.includes('jacket') || categoryHint.includes('coat')) {
          categoryInstruction = 'outerwear, jacket, coat';
        } else if (categoryHint.includes('shoes')) {
          categoryInstruction = 'footwear, shoes, boots for feet';
        } else if (categoryHint.includes('accessory')) {
          categoryInstruction = 'accessory, hat, scarf, jewelry';
        }
        
        const description = `${categoryInstruction}. ${userComment || 'high quality clothing, photorealistic, preserve original colors'}`;
        
        const itemNumber = i + 1;
        const totalItems = processedItems.length;
        
        toast.info(`Примеряем ${categoryHint}: ${item.categories[0] || 'одежда'} (${itemNumber}/${totalItems})`, {
          duration: 3000
        });
        
        console.log(`\n=== STEP ${itemNumber}/${totalItems} ===`);
        console.log('Item ID:', item.id);
        console.log('Categories array (RAW):', JSON.stringify(item.categories));
        console.log('Detected category type:', categoryHint);
        console.log('User comment:', item.comment || 'none');
        console.log('Description sent to API:', description);
        console.log('Person image length:', currentPersonImage.length);
        console.log('Person image type:', currentPersonImage.startsWith('data:') ? 'base64' : 'URL');
        console.log('Garment image length:', item.image.length);
        console.log('Garment image type:', item.image.startsWith('data:') ? 'base64' : 'URL');
        console.log('Full item data:', JSON.stringify({
          id: item.id,
          categories: item.categories,
          categoryHint: categoryHint,
          hasComment: !!item.comment
        }));
        
        // Отправляем запрос на генерацию
        const submitResponse = await fetch('https://functions.poehali.dev/87fa03b9-724d-4af9-85a2-dda57f503885', {
          signal: controller.signal,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            person_image: currentPersonImage,
            garment_image: item.image,
            description: description
          })
        });

        const submitData = await submitResponse.json();
        
        if (!submitResponse.ok) {
          throw new Error(submitData.error || 'Failed to submit generation');
        }
        
        const statusUrl = submitData.status_url;
        
        if (!statusUrl) {
          throw new Error('No status URL returned');
        }

        // Ждем завершения генерации
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
              const baseProgress = (i / totalItems) * 100;
              const stepProgress = (checkCount / maxChecks) * (100 / totalItems);
              setLoadingProgress(Math.min(baseProgress + stepProgress, 95));
              
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
        
        // Получаем результат и используем его для следующей итерации
        const resultImageUrl = await waitForCompletion();
        currentPersonImage = resultImageUrl;
        
        console.log(`Step ${itemNumber} completed:`, resultImageUrl.substring(0, 50));
      }
      
      // Все элементы примерены успешно
      setLoadingProgress(100);
      setGeneratedImage(currentPersonImage);
      console.log('=== GENERATION COMPLETE ===');
      console.log('Final image URL:', currentPersonImage.substring(0, 80));
      toast.success(`Все элементы (${sortedItems.length}) успешно примерены!`);
      setIsGenerating(false);
      
      // Сохраняем в историю
      if (user) {
        try {
          await fetch('https://functions.poehali.dev/8436b2bf-ae39-4d91-b2b7-91951b4235cd', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-User-Id': user.id
            },
            body: JSON.stringify({
              person_image: uploadedImage,
              garment_image: allClothingItems[0].image,
              result_image: currentPersonImage
            })
          });
        } catch (historyError) {
          console.warn('Failed to save to history:', historyError);
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
                              <p className="font-medium mb-1">✨ Удобная загрузка с автоочисткой:</p>
                              <ul className="list-disc pl-4 space-y-0.5">
                                <li><strong>Фон удалится автоматически</strong> при генерации</li>
                                <li>Можете загружать фото с любым фоном</li>
                                <li>Или используйте кнопку "Удалить фон" для предпросмотра</li>
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
                                      className="w-full text-xs"
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
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => removeCustomClothing(item.id)}
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

            <Card className="animate-scale-in" style={{ animationDelay: '0.1s' }}>
              <CardContent className="p-8">
                <div className="min-h-[500px] flex items-center justify-center bg-muted rounded-lg">
                  {isGenerating && !generatedImage ? (
                    <div className="text-center space-y-4">
                      <Icon name="Loader2" className="mx-auto text-primary animate-spin" size={64} />
                      <div className="space-y-2">
                        <p className="text-lg font-medium">Генерируем примерку...</p>
                        <p className="text-sm text-muted-foreground">
                          {loadingProgress < 50 ? 'Модель загружается (первый запуск может занять до минуты)' : 'Обрабатываем изображение...'}
                        </p>
                      </div>
                    </div>
                  ) : generatedImage ? (
                    <div className="space-y-4">
                      <img 
                        src={generatedImage} 
                        alt="Generated result" 
                        className="max-w-full max-h-[500px] object-contain rounded-lg animate-fade-in" 
                      />
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <Button 
                            variant="outline" 
                            onClick={handleDownloadImage}
                            className="w-full"
                          >
                            <Icon name="Download" className="mr-2" size={20} />
                            Скачать
                          </Button>
                          {user && (
                            <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                              <DialogTrigger asChild>
                                <Button className="w-full" variant="outline">
                                  <Icon name="BookmarkPlus" className="mr-2" size={20} />
                                  В лукбук
                                </Button>
                              </DialogTrigger>
                          <DialogContent onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
                            <DialogHeader>
                              <DialogTitle>Сохранить в лукбук</DialogTitle>
                              <DialogDescription>
                                Выберите существующий лукбук или создайте новый
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              {lookbooks.length > 0 && (
                                <div className="space-y-2">
                                  <Label>Существующий лукбук</Label>
                                  <Select value={selectedLookbookId} onValueChange={setSelectedLookbookId}>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Выберите лукбук" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {lookbooks.map((lb) => (
                                        <SelectItem key={lb.id} value={lb.id}>
                                          {lb.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button 
                                    className="w-full" 
                                    onClick={handleSaveToExistingLookbook}
                                    disabled={!selectedLookbookId || isSaving}
                                  >
                                    {isSaving ? 'Сохранение...' : 'Добавить в выбранный'}
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

                              <div className="space-y-2">
                                <Label htmlFor="lookbook-name">Название лукбука</Label>
                                <Input
                                  id="lookbook-name"
                                  placeholder="Весна 2025"
                                  value={newLookbookName}
                                  onChange={(e) => setNewLookbookName(e.target.value)}
                                />
                              </div>
                              
                              <div className="space-y-2">
                                <Label htmlFor="person-name">Имя человека</Label>
                                <Input
                                  id="person-name"
                                  placeholder="Анна"
                                  value={newLookbookPersonName}
                                  onChange={(e) => setNewLookbookPersonName(e.target.value)}
                                />
                              </div>

                              <Button 
                                className="w-full" 
                                onClick={handleSaveToNewLookbook}
                                disabled={!newLookbookName || !newLookbookPersonName || isSaving}
                              >
                                {isSaving ? 'Создание...' : 'Создать и добавить'}
                              </Button>

                              <Button 
                                variant="ghost" 
                                className="w-full" 
                                onClick={() => setShowSaveDialog(false)}
                              >
                                Отмена
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                          )}
                        </div>
                        <Button 
                          variant="secondary" 
                          onClick={handleReset}
                          className="w-full"
                        >
                          <Icon name="RotateCcw" className="mr-2" size={20} />
                          Начать заново
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center space-y-3">
                      <Icon name="Image" className="mx-auto text-muted-foreground" size={48} />
                      <p className="text-muted-foreground">
                        Здесь появится изображение
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="guide" className="py-20 px-4 bg-card">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-4xl font-light text-center mb-12">
            Как пользоваться примерочной
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center space-y-4 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Icon name="Upload" className="text-primary" size={32} />
              </div>
              <h3 className="text-xl font-medium">1. Загрузите фото</h3>
              <p className="text-muted-foreground text-sm">
                Выберите чёткую фотографию в полный рост на светлом фоне
              </p>
            </div>
            <div className="text-center space-y-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Icon name="Shirt" className="text-primary" size={32} />
              </div>
              <h3 className="text-xl font-medium">2. Выберите одежду</h3>
              <p className="text-muted-foreground text-sm">
                Выберите из каталога или загрузите своё фото одежды
              </p>
            </div>
            <div className="text-center space-y-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Icon name="Sparkles" className="text-primary" size={32} />
              </div>
              <h3 className="text-xl font-medium">3. Получите результат</h3>
              <p className="text-muted-foreground text-sm">
                AI создаст реалистичное изображение с выбранной одеждой
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="py-20 px-4">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-4xl font-light text-center mb-12">
            Часто задаваемые вопросы
          </h2>
          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="item-1" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left">
                Какие требования к фотографии?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Фотография должна быть чёткой, в полный рост, на светлом однородном фоне. 
                Человек должен быть в облегающей одежде или спортивной форме для лучшего результата.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-2" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left">
                Как работает технология?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Мы используем передовые AI модели машинного обучения (GAN) и компьютерного зрения 
                для реалистичного наложения одежды на фигуру с учётом освещения и пропорций.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-3" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left">
                Сколько времени занимает генерация?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <p className="mb-2">Процесс состоит из нескольких этапов:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>Предобработка:</strong> 3-5 секунд на каждое изображение (удаление фона)</li>
                  <li><strong>Примерка:</strong> 10-20 секунд на каждый элемент одежды</li>
                  <li><strong>Итого:</strong> при выборе 3 элементов ~45-75 секунд</li>
                </ul>
                <p className="mt-2 text-sm">Первый запуск может быть медленнее (~1-2 минуты) из-за загрузки AI моделей.</p>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-4" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left">
                Можно ли использовать свою одежду?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <p className="mb-2">Да! Откройте раздел "Загрузить своё фото" и добавьте изображение.</p>
                <p className="mb-2"><strong>Хорошая новость:</strong> фон удаляется автоматически! Можете загружать:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Фото с любым фоном (будет удалён автоматически)</li>
                  <li>Фото манекена в одежде (AI выделит нужный элемент)</li>
                  <li>Профессиональные фото товаров</li>
                </ul>
                <p className="mt-2"><strong>Важно:</strong> предмет должен быть виден полностью, выберите правильную категорию.</p>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-5" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left">
                Что делать, если результат неточный?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <p className="mb-2">Основные причины неточностей:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li><strong>Обрезанные элементы:</strong> если брюки обрезаны снизу на фото, AI может принять их за шорты</li>
                  <li><strong>Фото человека:</strong> должно быть в полный рост, чёткое, на светлом фоне</li>
                  <li><strong>Неправильная категория:</strong> убедитесь что выбрана правильная категория одежды</li>
                  <li><strong>Низкое качество:</strong> размытые или тёмные фото снижают точность</li>
                </ul>
                <p className="mt-2 text-sm"><strong>Помните:</strong> фон удаляется автоматически, не переживайте если он не идеальный!</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      <footer className="border-t border-border py-12 px-4">
        <div className="container mx-auto text-center text-muted-foreground">
          <p className="text-sm">
            © 2025 Virtual Fitting. Технология виртуальной примерочной на базе AI
          </p>
        </div>
      </footer>
    </Layout>
  );
}