import { toast } from 'sonner';

interface User {
  id: string;
  email: string;
  name: string;
}

interface SelectedClothing {
  id: string;
  image: string;
  name?: string;
  categories: string[];
}

export const continuePolling = async (
  statusUrl: string,
  personImage: string,
  garmentImg: string,
  user: User | null,
  setLoadingProgress: (progress: number | ((prev: number) => number)) => void,
  setGeneratedImage: (url: string | null) => void,
  setIsGenerating: (generating: boolean) => void
) => {
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

export const handleGenerate = async (
  user: User | null,
  uploadedImage: string | null,
  selectedClothing: SelectedClothing | null,
  balanceCheckPassed: boolean,
  setAbortController: (controller: AbortController | null) => void,
  setIsGenerating: (generating: boolean) => void,
  setLoadingProgress: (progress: number | ((prev: number) => number)) => void,
  setGeneratedImage: (url: string | null) => void
): Promise<void> => {
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

  if (!balanceCheckPassed) {
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
