import { useState, useRef } from 'react';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ImageCropperProps {
  image: string;
  open: boolean;
  onClose: () => void;
  onCropComplete: (croppedImage: string) => void;
  aspectRatio?: number | undefined;
}

export default function ImageCropper({ image, open, onClose, onCropComplete, aspectRatio }: ImageCropperProps) {
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    x: 25,
    y: 25,
    width: 50,
    height: 50
  });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [customAspect, setCustomAspect] = useState<number | undefined>(aspectRatio);
  const imgRef = useRef<HTMLImageElement>(null);

  const createCroppedImage = async () => {
    if (!imgRef.current) return;

    const cropToUse = completedCrop || crop;
    
    if (!cropToUse || cropToUse.width === 0 || cropToUse.height === 0) {
      onCropComplete(image);
      onClose();
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height;

    let pixelCrop = cropToUse;
    if (cropToUse.unit === '%') {
      pixelCrop = {
        x: (cropToUse.x / 100) * imgRef.current.width,
        y: (cropToUse.y / 100) * imgRef.current.height,
        width: (cropToUse.width / 100) * imgRef.current.width,
        height: (cropToUse.height / 100) * imgRef.current.height,
        unit: 'px'
      };
    }

    canvas.width = pixelCrop.width * scaleX;
    canvas.height = pixelCrop.height * scaleY;

    ctx.drawImage(
      imgRef.current,
      pixelCrop.x * scaleX,
      pixelCrop.y * scaleY,
      pixelCrop.width * scaleX,
      pixelCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    canvas.toBlob((blob) => {
      if (!blob) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        onCropComplete(reader.result as string);
        onClose();
      };
      reader.readAsDataURL(blob);
    }, 'image/jpeg', 0.95);
  };

  const handleAspectChange = (aspect: number | undefined) => {
    setCustomAspect(aspect);
    if (aspect) {
      setCrop({
        unit: '%',
        x: 25,
        y: 25,
        width: 50,
        height: 50 / aspect
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Кадрировать изображение</DialogTitle>
        </DialogHeader>
        
        <div className="w-full bg-muted rounded-lg p-4 flex items-center justify-center overflow-auto flex-shrink min-h-0" style={{ maxHeight: 'calc(90vh - 300px)' }}>
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={customAspect}
          >
            <img
              ref={imgRef}
              src={image}
              alt="Crop"
              crossOrigin="anonymous"
              style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
            />
          </ReactCrop>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {customAspect === undefined 
                ? 'Потяните за углы или края, чтобы изменить размер области обрезки' 
                : 'Выбраны фиксированные пропорции. Измените размер области обрезки'}
            </p>
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant={customAspect === undefined ? 'default' : 'outline'}
                onClick={() => handleAspectChange(undefined)}
              >
                Свободно
              </Button>
              <Button
                size="sm"
                variant={customAspect === 1 ? 'default' : 'outline'}
                onClick={() => handleAspectChange(1)}
              >
                Квадрат
              </Button>
              <Button
                size="sm"
                variant={customAspect === 3/4 ? 'default' : 'outline'}
                onClick={() => handleAspectChange(3/4)}
              >
                3:4
              </Button>
              <Button
                size="sm"
                variant={customAspect === 4/3 ? 'default' : 'outline'}
                onClick={() => handleAspectChange(4/3)}
              >
                4:3
              </Button>
              <Button
                size="sm"
                variant={customAspect === 16/9 ? 'default' : 'outline'}
                onClick={() => handleAspectChange(16/9)}
              >
                16:9
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={createCroppedImage}>
            Применить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}