import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';
import ImageCropper from '@/components/ImageCropper';
import ClothingZoneEditor from '@/components/ClothingZoneEditor';
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

interface ClothingZone {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SelectedClothing {
  id: string;
  image: string;
  comment: string;
  categories: string[];
  zone?: ClothingZone;
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
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<{ id: string; image: string; type: 'clothing' } | null>(null);
  const [showClothingZoneEditor, setShowClothingZoneEditor] = useState(false);
  const [clothingToMarkZone, setClothingToMarkZone] = useState<{ id: string; image: string; name?: string; isCatalog: boolean } | null>(null);

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

  const handleMarkClothingZone = (clothingId: string, clothingImage: string, clothingName: string | undefined, isCatalog: boolean) => {
    if (!uploadedImage) {
      toast.error('Сначала загрузите фото человека');
      return;
    }
    setClothingToMarkZone({ id: clothingId, image: clothingImage, name: clothingName, isCatalog });
    setShowClothingZoneEditor(true);
  };

  const handleSaveClothingZone = (zone: ClothingZone) => {
    if (!clothingToMarkZone) return;

    if (clothingToMarkZone.isCatalog) {
      setSelectedClothingItems(prev => prev.map(item =>
        item.id === clothingToMarkZone.id ? { ...item, zone } : item
      ));
    } else {
      setCustomClothingItems(prev => prev.map(item =>
        item.id === clothingToMarkZone.id ? { ...item, zone } : item
      ));
    }

    setShowClothingZoneEditor(false);
    setClothingToMarkZone(null);
    toast.success('Область примерки сохранена!');
  };

  const handleCustomClothingUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const id = `custom-${Date.now()}-${Math.random()}`;
        setImageToCrop({ id, image: reader.result as string, type: 'clothing' });
        setCropDialogOpen(true);
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
  
  const handleCropImage = (id: string, image: string) => {
    setImageToCrop({ id, image, type: 'clothing' });
    setCropDialogOpen(true);
  };


  
  const handleCropComplete = (croppedImage: string) => {
    if (imageToCrop) {
      if (imageToCrop.type === 'clothing') {
        const existingItem = customClothingItems.find(item => item.id === imageToCrop.id);
        if (existingItem) {
          setCustomClothingItems(customClothingItems.map(item =>
            item.id === imageToCrop.id ? { ...item, image: croppedImage } : item
          ));
        } else {
          const newItem: SelectedClothing = {
            id: imageToCrop.id,
            image: croppedImage,
            comment: '',
            categories: []
          };
          setCustomClothingItems(prev => [...prev, newItem]);
        }
      }
    }
    setImageToCrop(null);
    setCropDialogOpen(false);
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
      return imageUrl;
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
  
  const getCategoryPlacementHint = (categories: string[]): string => {
    if (!categories || categories.length === 0) return 'clothing item';
    
    const categoryLower = categories.map(c => c.toLowerCase());
    
    if (categoryLower.some(c => c.includes('весь образ') || c.includes('full outfit') || c.includes('complete look'))) {
      return 'complete outfit';
    }
    
    if (categoryLower.some(c => c.includes('платье') || c.includes('dress'))) {
      return 'dress';
    }
    
    if (categoryLower.some(c => c.includes('топ') || c.includes('блузка') || c.includes('блуза') || c.includes('футболка') || c.includes('рубашка') || c.includes('top') || c.includes('blouse') || c.includes('shirt') || c.includes('t-shirt'))) {
      return 'top';
    }
    
    if (categoryLower.some(c => c.includes('брюки') || c.includes('джинсы') || c.includes('штаны') || c.includes('pants') || c.includes('trousers') || c.includes('jeans'))) {
      return 'pants';
    }
    if (categoryLower.some(c => c.includes('юбка') || c.includes('skirt'))) {
      return 'skirt';
    }
    
    if (categoryLower.some(c => c.includes('куртка') || c.includes('пальто') || c.includes('jacket') || c.includes('coat'))) {
      return 'jacket';
    }
    
    if (categoryLower.some(c => c.includes('обувь') || c.includes('туфли') || c.includes('ботинки') || c.includes('сапоги') || c.includes('кроссовки') || c.includes('shoes') || c.includes('boots') || c.includes('sneakers') || c.includes('heels'))) {
      return 'shoes';
    }
    
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

    const customItemsWithCategory = customClothingItems.filter(item => item.categories && item.categories.length > 0);
    const allClothingItems = [...selectedClothingItems, ...customItemsWithCategory];
    
    if (allClothingItems.length === 0) {
      toast.error('Выберите или загрузите одежду');
      return;
    }
    
    const customItemsWithoutCategory = customClothingItems.filter(item => !item.categories || item.categories.length === 0);
    if (customItemsWithoutCategory.length > 0) {
      toast.error('Укажите категорию для всех загруженных элементов одежды');
      return;
    }
    
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
      
      toast.info('Подготовка изображений...', { duration: 2000 });
      console.log('=== PREPROCESSING USER IMAGES ===');
      
      const processedItems = await Promise.all(
        sortedItems.map(async (item, idx) => {
          const isCustomItem = item.id.startsWith('custom-');
          
          if (isCustomItem) {
            console.log(`Preprocessing custom item ${idx + 1}/${sortedItems.length}: ${item.id}`);
            try {
              const processedImage = await processImageBackground(item.image, `preprocessing-${item.id}`);
              console.log(`Custom item ${idx + 1} processed successfully`);
              return { ...item, image: processedImage };
            } catch (error) {
              console.warn(`Failed to preprocess custom item ${idx + 1}, using original:`, error);
              return item;
            }
          } else {
            console.log(`Item ${idx + 1} from catalog (already processed): ${item.id}`);
            return item;
          }
        })
      );
      
      console.log('All images ready');
      toast.success('Начинаем примерку...', { duration: 2000 });
      
      for (let i = 0; i < processedItems.length; i++) {
        const item = processedItems[i];
        const categoryHint = getCategoryPlacementHint(item.categories);
        const userComment = item.comment ? ` ${item.comment}` : '';
        
        const description = userComment || 'high quality clothing, photorealistic, preserve original colors';
        
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
          hasComment: !!item.comment,
          hasZone: !!item.zone
        }));
        
        const requestBody: any = {
          person_image: currentPersonImage,
          garment_image: item.image,
          description: description
        };
        
        if (item.zone) {
          requestBody.target_zone = item.zone;
          console.log('Sending target zone:', item.zone);
        }
        
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
        
        const resultImageUrl = await waitForCompletion();
        currentPersonImage = resultImageUrl;
        
        console.log(`Step ${itemNumber} completed:`, resultImageUrl.substring(0, 50));
      }
      
      setLoadingProgress(100);
      setGeneratedImage(currentPersonImage);
      console.log('=== GENERATION COMPLETE ===');
      console.log('Final image URL:', currentPersonImage.substring(0, 80));
      toast.success(`Все элементы (${sortedItems.length}) успешно примерены!`);
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
              garment_image: processedItems[0].image,
              result_image: currentPersonImage
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
              selectedClothingItems={selectedClothingItems}
              customClothingItems={customClothingItems}
              clothingCatalog={clothingCatalog}
              filters={filters}
              selectedCategories={selectedCategories}
              selectedColors={selectedColors}
              selectedArchetypes={selectedArchetypes}
              setSelectedCategories={setSelectedCategories}
              setSelectedColors={setSelectedColors}
              setSelectedArchetypes={setSelectedArchetypes}
              toggleClothingSelection={toggleClothingSelection}
              updateClothingComment={updateClothingComment}
              setSelectedClothingItems={setSelectedClothingItems}
              handleCustomClothingUpload={handleCustomClothingUpload}
              updateCustomClothingCategory={updateCustomClothingCategory}
              updateCustomClothingComment={updateCustomClothingComment}
              handleCropImage={handleCropImage}
              processImageBackground={processImageBackground}
              setCustomClothingItems={setCustomClothingItems}
              processingImages={processingImages}
              handleGenerate={handleGenerate}
              isGenerating={isGenerating}
              loadingProgress={loadingProgress}
              handleCancelGeneration={handleCancelGeneration}
              onMarkClothingZone={handleMarkClothingZone}
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

      {imageToCrop && (
        <ImageCropper
          image={imageToCrop.image}
          open={cropDialogOpen}
          onClose={() => {
            setCropDialogOpen(false);
            setImageToCrop(null);
          }}
          onCropComplete={handleCropComplete}
          aspectRatio={3/4}
        />
      )}

      {showClothingZoneEditor && uploadedImage && clothingToMarkZone && (
        <ClothingZoneEditor
          personImage={uploadedImage}
          clothingImage={clothingToMarkZone.image}
          clothingName={clothingToMarkZone.name}
          onSave={handleSaveClothingZone}
          onClose={() => {
            setShowClothingZoneEditor(false);
            setClothingToMarkZone(null);
          }}
          existingZone={
            clothingToMarkZone.isCatalog
              ? selectedClothingItems.find(i => i.id === clothingToMarkZone.id)?.zone
              : customClothingItems.find(i => i.id === clothingToMarkZone.id)?.zone
          }
        />
      )}
    </Layout>
  );
}