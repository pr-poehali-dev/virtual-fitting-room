import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import ImageViewer from '@/components/ImageViewer';

interface ReplicateResultPanelProps {
  isGenerating: boolean;
  generatedImage: string | null;
  isSavingToS3: boolean;
  handleDownloadImage: () => void;
  setShowSaveDialog: (show: boolean) => void;
  handleReset: () => void;
}

export default function ReplicateResultPanel({
  isGenerating,
  generatedImage,
  isSavingToS3,
  handleDownloadImage,
  setShowSaveDialog,
  handleReset
}: ReplicateResultPanelProps) {
  return (
    <Card className="animate-scale-in">
      <CardHeader>
        <CardTitle className="text-2xl">
          <Icon name="Image" className="inline mr-2" size={24} />
          Результат
        </CardTitle>
      </CardHeader>
      <CardContent className="p-8">
        {isGenerating ? (
          <div className="flex flex-col items-center justify-center h-[500px] space-y-4">
            <Icon name="Loader2" className="animate-spin text-primary" size={64} />
            <p className="text-lg font-medium">Создаём образ...</p>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              AI анализирует выбранные вещи и создаёт реалистичный образ. Подождите от 30 секунд до 2 минут
            </p>
            <p className="text-xs text-center max-w-sm mt-1">
              Не закрывайте страницу до завершения генерации
            </p>
          </div>
        ) : generatedImage ? (
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg mb-4">
              <p className="text-sm font-medium text-green-900 dark:text-green-100">
                🎉 Образ готов!
              </p>
              <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                Не забудьте сохранить фото, если результат работы нейросети Вам нравится!
              </p>
            </div>
            <div className="flex justify-center">
              <div className="relative w-full max-w-md" style={{ aspectRatio: '3/4' }}>
                <ImageViewer
                  src={generatedImage}
                  alt="Generated result"
                  className="rounded-lg w-full h-full object-cover"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {isSavingToS3 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Icon name="Loader2" className="animate-spin text-blue-600" size={16} />
                    <p className="text-sm font-medium text-blue-900">Сохраняем в историю...</p>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={handleDownloadImage} className="flex-1">
                  <Icon name="Download" className="mr-2" size={16} />
                  Скачать
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setShowSaveDialog(true)} 
                  className="flex-1"
                  disabled={isSavingToS3}
                >
                  <Icon name="BookOpen" className="mr-2" size={16} />
                  В лукбук
                </Button>
              </div>
              <Button 
                variant="ghost" 
                onClick={handleReset} 
                className="w-full"
                disabled={isSavingToS3}
              >
                <Icon name="RotateCcw" className="mr-2" size={16} />
                Новая примерка
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-[500px] text-center space-y-4">
            <Icon name="Image" size={48} className="text-gray-300" />
            <div>
              <p className="text-lg font-medium mb-2">Здесь появится результат</p>
              <p className="text-sm text-muted-foreground max-w-sm">
                Загрузите фото модели, выберите вещи и нажмите "Создать образ"
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}