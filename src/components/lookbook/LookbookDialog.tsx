import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import ImageCropper from '@/components/ImageCropper';

interface LookbookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  lookbookName: string;
  setLookbookName: (name: string) => void;
  personName: string;
  setPersonName: (name: string) => void;
  selectedPhotos: string[];
  setSelectedPhotos: (photos: string[] | ((prev: string[]) => string[])) => void;
  colorPalette: string[];
  setColorPalette: (colors: string[]) => void;
  onSubmit: () => void;
  onPhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveBackground: (index: number) => void;
  onCropImage: (index: number) => void;
  isProcessingImage: boolean;
  showCropper: boolean;
  setShowCropper: (show: boolean) => void;
  imageToCrop: string;
  onCropComplete: (croppedImage: string) => void;
}

export default function LookbookDialog({
  open,
  onOpenChange,
  mode,
  lookbookName,
  setLookbookName,
  personName,
  setPersonName,
  selectedPhotos,
  setSelectedPhotos,
  colorPalette,
  setColorPalette,
  onSubmit,
  onPhotoUpload,
  onRemoveBackground,
  onCropImage,
  isProcessingImage,
  showCropper,
  setShowCropper,
  imageToCrop,
  onCropComplete
}: LookbookDialogProps) {
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{mode === 'create' ? 'Новый лукбук' : 'Редактировать лукбук'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Название лукбука</label>
              <Input
                placeholder="Например: Летний гардероб 2024"
                value={lookbookName}
                onChange={(e) => setLookbookName(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Для кого</label>
              <Input
                placeholder="Имя человека"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Фотографии</label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={onPhotoUpload}
                className="hidden"
                id="photo-upload"
              />
              <label htmlFor="photo-upload">
                <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors">
                  <Icon name="Upload" className="mx-auto mb-2" size={32} />
                  <p className="text-sm text-muted-foreground">Нажмите для загрузки фото</p>
                </div>
              </label>

              {selectedPhotos.length > 0 && (
                <div className="grid grid-cols-3 gap-4 mt-4">
                  {selectedPhotos.map((photo, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={photo}
                        alt={`Photo ${index + 1}`}
                        className="w-full h-32 object-cover rounded"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onCropImage(index)}
                        >
                          <Icon name="Crop" size={16} />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onRemoveBackground(index)}
                          disabled={isProcessingImage}
                        >
                          {isProcessingImage ? (
                            <Icon name="Loader2" className="animate-spin" size={16} />
                          ) : (
                            <Icon name="Eraser" size={16} />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setSelectedPhotos(prev => prev.filter((_, i) => i !== index))}
                        >
                          <Icon name="Trash2" size={16} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Цветовая палитра</label>
              <div className="flex gap-2">
                {colorPalette.map((color, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => {
                        const newPalette = [...colorPalette];
                        newPalette[index] = e.target.value;
                        setColorPalette(newPalette);
                      }}
                      className="w-12 h-12 rounded cursor-pointer"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setColorPalette(prev => prev.filter((_, i) => i !== index))}
                    >
                      <Icon name="X" size={16} />
                    </Button>
                  </div>
                ))}
                {colorPalette.length < 6 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setColorPalette([...colorPalette, '#000000'])}
                  >
                    <Icon name="Plus" size={16} />
                  </Button>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={onSubmit} className="flex-1">
                {mode === 'create' ? 'Создать' : 'Сохранить'}
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                Отмена
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showCropper && imageToCrop && (
        <ImageCropper
          image={imageToCrop}
          open={showCropper}
          onClose={() => setShowCropper(false)}
          onCropComplete={onCropComplete}
        />
      )}
    </>
  );
}
