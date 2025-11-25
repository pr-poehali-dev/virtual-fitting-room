import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import ImageViewer from '@/components/ImageViewer';

interface ReplicateResultPanelProps {
  isGenerating: boolean;
  generatedImage: string | null;
  intermediateResult: string | null;
  waitingContinue: boolean;
  currentStep: number;
  totalSteps: number;
  promptHints: string;
  handleDownloadImage: () => void;
  setShowSaveDialog: (show: boolean) => void;
  handleReset: () => void;
  handleContinueGeneration: () => void;
}

export default function ReplicateResultPanel({
  isGenerating,
  generatedImage,
  intermediateResult,
  waitingContinue,
  currentStep,
  totalSteps,
  promptHints,
  handleDownloadImage,
  setShowSaveDialog,
  handleReset,
  handleContinueGeneration
}: ReplicateResultPanelProps) {
  const isPromptStep = currentStep > totalSteps;
  const displayStep = isPromptStep ? 'Применяем промпт' : `Шаг ${currentStep} из ${totalSteps}`;
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
              AI анализирует выбранные вещи и создаёт реалистичный образ. Подождите, это может занять 2-6 минут
            </p>
            {currentStep > 0 && (
              <p className="text-sm font-medium text-primary">
                {displayStep}
              </p>
            )}
          </div>
        ) : waitingContinue && intermediateResult ? (
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg mb-4">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                ✅ {displayStep} готов!
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                Проверьте результат и нажмите "Продолжить" для следующей вещи
              </p>
            </div>
            <ImageViewer
              src={intermediateResult}
              alt="Промежуточный результат"
              className="rounded-lg"
            />
            <div className="flex flex-col gap-2">
              <Button onClick={handleContinueGeneration} size="lg" className="w-full">
                <Icon name="ArrowRight" className="mr-2" size={20} />
                {currentStep < totalSteps ? `Продолжить (шаг ${currentStep + 1}/${totalSteps})` : 'Применить промпт'}
              </Button>
              <div className="flex gap-2">
                <Button onClick={handleDownloadImage} variant="outline" className="flex-1">
                  <Icon name="Download" className="mr-2" size={16} />
                  Скачать текущий
                </Button>
                <Button variant="outline" onClick={handleReset} className="flex-1">
                  <Icon name="RotateCcw" className="mr-2" size={16} />
                  Начать заново
                </Button>
              </div>
            </div>
          </div>
        ) : generatedImage ? (
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg mb-4">
              <p className="text-sm font-medium text-green-900 dark:text-green-100">
                🎉 Все {totalSteps} шага завершены!
              </p>
            </div>
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