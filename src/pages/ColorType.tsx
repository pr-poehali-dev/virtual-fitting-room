import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import ImageCropper from '@/components/ImageCropper';
import { validateImageFile } from '@/utils/fileValidation';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useNavigate } from 'react-router-dom';

const COLORTYPE_START_API = 'https://functions.poehali.dev/f5ab39bd-a682-44d8-ac47-d7b9d035013b';
const COLORTYPE_STATUS_API = 'https://functions.poehali.dev/7f1395ac-bddc-45ec-b997-b39497110680';
const IMAGE_PREPROCESSING_API = 'https://functions.poehali.dev/3fe8c892-ab5f-4d26-a2c5-ae4166276334';
const IMAGE_PROXY_API = 'https://functions.poehali.dev/7f105c4b-f9e7-4df3-9f64-3d35895b8e90';

const COST = 30;
const POLLING_INTERVAL = 30000; // 30 seconds
const TIMEOUT_DURATION = 180000; // 3 minutes

// Helper function to proxy fal.ai images through our backend
const proxyFalImage = async (falUrl: string): Promise<string> => {
  try {
    if (!falUrl.includes('fal.media') && !falUrl.includes('fal.ai')) {
      return falUrl;
    }
    
    console.log('[ImageProxy] Proxying fal.ai image:', falUrl);
    const response = await fetch(`${IMAGE_PROXY_API}?url=${encodeURIComponent(falUrl)}`);
    
    if (!response.ok) {
      console.error('[ImageProxy] Failed to proxy image:', response.status);
      return falUrl;
    }
    
    const data = await response.json();
    console.log('[ImageProxy] Successfully proxied image');
    return data.data_url;
  } catch (error) {
    console.error('[ImageProxy] Error proxying image:', error);
    return falUrl;
  }
};

// Mapping English color types to Russian
const colorTypeNames: Record<string, string> = {
  'SOFT WINTER': 'Мягкая Зима',
  'BRIGHT WINTER': 'Яркая Зима',
  'VIVID WINTER': 'Насыщенная Зима',
  'SOFT SUMMER': 'Мягкое Лето',
  'DUSTY SUMMER': 'Пыльное Лето',
  'VIVID SUMMER': 'Насыщенное Лето',
  'GENTLE AUTUMN': 'Нежная Осень',
  'FIERY AUTUMN': 'Огненная Осень',
  'VIVID AUTUMN': 'Насыщенная Осень',
  'GENTLE SPRING': 'Нежная Весна',
  'BRIGHT SPRING': 'Яркая Весна',
  'VIBRANT SPRING': 'Сочная Весна'
};

export default function ColorType() {
  const { user } = useAuth();
  const { refetchColorTypeHistory } = useData();
  const navigate = useNavigate();
  
  // Debug: проверка unlimited_access
  console.log('[ColorType] User object:', user);
  console.log('[ColorType] unlimited_access value:', user?.unlimited_access);
  
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [tempImageForCrop, setTempImageForCrop] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState<string>('');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  
  const [result, setResult] = useState<{
    colorType: string;
    description: string;
  } | null>(null);
  
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const resizeImage = (base64Str: string, maxWidth: number, maxHeight: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const aspectRatio = width / height;
          if (width > height) {
            width = maxWidth;
            height = width / aspectRatio;
          } else {
            height = maxHeight;
            width = height * aspectRatio;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.src = base64Str;
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.isValid) {
      toast.error(validation.error || 'Неверный файл');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Image = reader.result as string;
      const resized = await resizeImage(base64Image, 1024, 1024);
      
      // Check aspect ratio and trigger cropper if needed
      const img = new Image();
      img.onload = () => {
        const aspectRatio = img.width / img.height;
        const targetAspectRatio = 3 / 4;
        const tolerance = 0.05;
        
        if (Math.abs(aspectRatio - targetAspectRatio) > tolerance) {
          setTempImageForCrop(resized);
          setShowCropper(true);
        } else {
          setUploadedImage(resized);
          processImageBackground(resized);
        }
      };
      img.src = resized;
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedImage: string) => {
    setShowCropper(false);
    setTempImageForCrop(null);
    const resized = await resizeImage(croppedImage, 1024, 1024);
    setUploadedImage(resized);
    processImageBackground(resized);
  };

  const processImageBackground = async (imageData: string) => {
    setIsProcessingImage(true);
    setAnalysisStatus('Удаление фона...');
    
    try {
      const uploadResponse = await fetch(IMAGE_PREPROCESSING_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: imageData })
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to process image');
      }

      const data = await uploadResponse.json();
      console.log('[ColorType] Background removal response:', data);
      
      const processedUrl = data.processed_image;
      if (processedUrl) {
        // Proxy fal.ai image to prevent expiration
        const proxiedUrl = await proxyFalImage(processedUrl);
        setProcessedImage(proxiedUrl);
        toast.success('Фон удалён, изображение готово');
      } else {
        throw new Error('No processed_image in response');
      }
    } catch (error) {
      console.error('Background removal error:', error);
      toast.error('Ошибка удаления фона, но можно продолжить');
      setProcessedImage(imageData);
    } finally {
      setIsProcessingImage(false);
      setAnalysisStatus('');
    }
  };

  const pollTaskStatus = async (id: string) => {
    try {
      const response = await fetch(`${COLORTYPE_STATUS_API}?task_id=${id}&force_check=true`);
      const data = await response.json();

      console.log('[ColorType] Poll status:', data);

      if (data.status === 'completed') {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        const colorTypeName = data.color_type ? colorTypeNames[data.color_type] || data.color_type : 'Неизвестно';
        
        setResult({
          colorType: colorTypeName,
          description: data.result_text || ''
        });
        setIsAnalyzing(false);
        setAnalysisStatus('');
        toast.success('Цветотип определён!');
        refetchColorTypeHistory();
      } else if (data.status === 'failed') {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        
        setIsAnalyzing(false);
        setAnalysisStatus('');
        toast.error('Ошибка анализа: ' + (data.result_text || 'Неизвестная ошибка'));
      } else if (data.status === 'processing') {
        setAnalysisStatus('Анализ изображения на нейросети...');
      } else if (data.status === 'pending') {
        setAnalysisStatus('Подготовка к анализу...');
      }
    } catch (error) {
      console.error('[ColorType] Polling error:', error);
    }
  };

  const handleAnalyze = async () => {
    if (!user) {
      toast.error('Войдите в аккаунт');
      navigate('/login');
      return;
    }

    const imageToAnalyze = processedImage || uploadedImage;
    if (!imageToAnalyze) {
      toast.error('Загрузите портретное фото');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisStatus('Запуск анализа...');
    setHasTimedOut(false);
    setResult(null);

    try {
      const response = await fetch(COLORTYPE_START_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': user.id
        },
        body: JSON.stringify({
          person_image: imageToAnalyze
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 402) {
          toast.error(`Недостаточно средств. Требуется ${COST} руб`);
          navigate('/profile/wallet');
          return;
        }
        throw new Error(data.error || 'Failed to start analysis');
      }

      const newTaskId = data.task_id;
      setTaskId(newTaskId);
      setAnalysisStatus('Обработка начата...');

      // Start polling
      pollingIntervalRef.current = setInterval(() => {
        pollTaskStatus(newTaskId);
      }, POLLING_INTERVAL);

      // Set timeout
      timeoutRef.current = setTimeout(() => {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        setHasTimedOut(true);
        setIsAnalyzing(false);
        setAnalysisStatus('');
        toast.error('Превышено время ожидания. Результат сохранится в истории.');
      }, TIMEOUT_DURATION);

    } catch (error) {
      setIsAnalyzing(false);
      setAnalysisStatus('');
      toast.error(error instanceof Error ? error.message : 'Ошибка запуска анализа');
    }
  };

  return (
    <Layout>
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-5xl md:text-6xl font-light mb-4">
              Определение цветотипа
            </h2>
            <p className="text-muted-foreground text-lg">
              Узнайте свой цветотип внешности с помощью AI • {COST} руб
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-start">
            {/* Left Panel - Upload */}
            <Card className="animate-scale-in">
              <CardContent className="p-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-3">
                      Загрузите портретное фото
                    </label>
                    <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer">
                      <input
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="portrait-upload"
                        disabled={isProcessingImage || isAnalyzing}
                      />
                      <label htmlFor="portrait-upload" className="cursor-pointer">
                        {(processedImage || uploadedImage) ? (
                          <img 
                            src={processedImage || uploadedImage} 
                            alt="Uploaded" 
                            className="max-h-64 mx-auto rounded-lg" 
                          />
                        ) : (
                          <div className="space-y-3">
                            <Icon name="Upload" className="mx-auto text-muted-foreground" size={48} />
                            <p className="text-muted-foreground">
                              Нажмите для загрузки портрета
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Фото при естественном освещении, хорошо видны волосы и глаза
                            </p>
                          </div>
                        )}
                      </label>
                    </div>
                    {isProcessingImage && (
                      <p className="text-sm text-muted-foreground text-center mt-2">
                        <Icon name="Loader2" className="inline animate-spin mr-2" size={16} />
                        Обработка изображения...
                      </p>
                    )}
                  </div>

                  <Button 
                    onClick={handleAnalyze} 
                    disabled={isAnalyzing || isProcessingImage || !uploadedImage}
                    className="w-full h-12 text-base"
                    size="lg"
                  >
                    {isAnalyzing ? (
                      <>
                        <Icon name="Loader2" className="mr-2 animate-spin" size={20} />
                        {analysisStatus || 'Анализ...'}
                      </>
                    ) : (
                      <>
                        <Icon name="Palette" className="mr-2" size={20} />
                        Определить цветотип
                      </>
                    )}
                  </Button>

                  {!user?.unlimited_access && !isAnalyzing && (
                    <p className="text-sm text-muted-foreground text-center">
                      Стоимость генерации: {COST}₽
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Right Panel - Result */}
            <Card className="animate-scale-in" style={{ animationDelay: '0.1s' }}>
              <CardContent className="p-8">
                <div className="min-h-[500px] flex items-center justify-center">
                  {result ? (
                    <div className="w-full space-y-6 animate-fade-in">
                      <div className="text-center">
                        <h3 className="text-3xl font-light mb-4">{result.colorType}</h3>
                        <div className="bg-muted rounded-lg p-6 text-sm">
                          <p className="whitespace-pre-wrap">{result.description}</p>
                        </div>
                      </div>

                      <Button 
                        onClick={() => navigate('/profile/history-colortypes')}
                        variant="outline"
                        className="w-full"
                      >
                        <Icon name="History" className="mr-2" size={20} />
                        Посмотреть историю
                      </Button>
                    </div>
                  ) : isAnalyzing ? (
                    <div className="text-center space-y-4">
                      <Icon name="Loader2" className="mx-auto text-primary animate-spin" size={48} />
                      <p className="text-muted-foreground">
                        {analysisStatus || 'Анализируем ваш цветотип...'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Это может занять до 3 минут
                      </p>
                    </div>
                  ) : hasTimedOut ? (
                    <div className="text-center space-y-3">
                      <Icon name="Clock" className="mx-auto text-muted-foreground" size={48} />
                      <p className="text-muted-foreground">
                        Анализ занял слишком много времени
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Результат сохранится в истории, когда будет готов
                      </p>
                    </div>
                  ) : (
                    <div className="text-center space-y-3">
                      <Icon name="Palette" className="mx-auto text-muted-foreground" size={48} />
                      <p className="text-muted-foreground">
                        Здесь появится ваш цветотип
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Image Cropper Dialog */}
      {showCropper && tempImageForCrop && (
        <ImageCropper
          image={tempImageForCrop}
          open={showCropper}
          onClose={() => {
            setShowCropper(false);
            setTempImageForCrop(null);
          }}
          onCropComplete={handleCropComplete}
          aspectRatio={3 / 4}
        />
      )}

      <footer className="border-t border-border py-12 px-4">
        <div className="container mx-auto text-center text-muted-foreground">
          <p className="text-sm">
            © 2025 Virtual Fitting. Технология определения цветотипа на базе AI
          </p>
        </div>
      </footer>
    </Layout>
  );
}