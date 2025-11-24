import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';

interface VirtualFittingResultProps {
  isGenerating: boolean;
  generatedImage: string | null;
  loadingProgress: number;
  handleDownloadImage: () => void;
  user: any;
  showSaveDialog: boolean;
  setShowSaveDialog: (show: boolean) => void;
  lookbooks: any[];
  selectedLookbookId: string;
  setSelectedLookbookId: (id: string) => void;
  handleSaveToExistingLookbook: () => void;
  isSaving: boolean;
  newLookbookName: string;
  setNewLookbookName: (name: string) => void;
  newLookbookPersonName: string;
  setNewLookbookPersonName: (name: string) => void;
  handleSaveToNewLookbook: () => void;
  handleReset: () => void;
}

export default function VirtualFittingResult({
  isGenerating,
  generatedImage,
  loadingProgress,
  handleDownloadImage,
  user,
  showSaveDialog,
  setShowSaveDialog,
  lookbooks,
  selectedLookbookId,
  setSelectedLookbookId,
  handleSaveToExistingLookbook,
  isSaving,
  newLookbookName,
  setNewLookbookName,
  newLookbookPersonName,
  setNewLookbookPersonName,
  handleSaveToNewLookbook,
  handleReset
}: VirtualFittingResultProps) {
  return (
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
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex gap-2">
                  <Icon name="Info" className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" size={16} />
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Если результат некорректный, попробуйте примерить одежду на другое фото
                  </p>
                </div>
              </div>
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
  );
}