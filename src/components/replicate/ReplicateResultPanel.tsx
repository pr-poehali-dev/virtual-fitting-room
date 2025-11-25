import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import ImageViewer from '@/components/ImageViewer';

interface ReplicateResultPanelProps {
  isGenerating: boolean;
  generatedImage: string | null;
  handleDownloadImage: () => void;
  setShowSaveDialog: (show: boolean) => void;
  handleReset: () => void;
}

export default function ReplicateResultPanel({
  isGenerating,
  generatedImage,
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
              Это может занять до 2 минут. AI анализирует выбранные вещи и создаёт реалистичный образ
            </p>
          </div>
        ) : generatedImage ? (
          <div className="space-y-4">
            <ImageViewer
              src={generatedImage}
              alt="Generated result"
              className="rounded-lg"
            />
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Button onClick={handleDownloadImage} className="flex-1">
                  <Icon name="Download" className="mr-2" size={16} />
                  Скачать
                </Button>
                <Button variant="outline" onClick={() => setShowSaveDialog(true)} className="flex-1">
                  <Icon name="BookOpen" className="mr-2" size={16} />
                  В лукбук
                </Button>
              </div>
              <Button variant="ghost" onClick={handleReset} className="w-full">
                <Icon name="RotateCcw" className="mr-2" size={16} />
                Новая примерка
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-[500px] text-center space-y-4">
            <Icon name="ImageOff" size={64} className="text-gray-300" />
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
