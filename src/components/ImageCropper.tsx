import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface ImageCropperProps {
  image: string;
  open: boolean;
  onClose: () => void;
  onCropComplete: (croppedImage: string) => void;
  aspectRatio?: number | undefined;
}

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function ImageCropper({ image, open, onClose, onCropComplete, aspectRatio }: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropArea | null>(null);
  const [customAspect, setCustomAspect] = useState<number | undefined>(aspectRatio);

  const onCropCompleteInternal = useCallback(
    (croppedArea: any, croppedAreaPixels: CropArea) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const createCroppedImage = async () => {
    if (!croppedAreaPixels) return;

    try {
      const imageElement = new Image();
      imageElement.src = image;
      
      await new Promise((resolve) => {
        imageElement.onload = resolve;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) return;

      canvas.width = croppedAreaPixels.width;
      canvas.height = croppedAreaPixels.height;

      ctx.drawImage(
        imageElement,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        croppedAreaPixels.width,
        croppedAreaPixels.height
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
    } catch (error) {
      console.error('Error cropping image:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Кадрировать изображение</DialogTitle>
        </DialogHeader>
        
        <div className="relative h-[400px] w-full bg-muted rounded-lg overflow-hidden">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={customAspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropCompleteInternal}
          />
        </div>

        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant={customAspect === undefined ? 'default' : 'outline'}
              onClick={() => setCustomAspect(undefined)}
            >
              Свободно
            </Button>
            <Button
              size="sm"
              variant={customAspect === 1 ? 'default' : 'outline'}
              onClick={() => setCustomAspect(1)}
            >
              Квадрат
            </Button>
            <Button
              size="sm"
              variant={customAspect === 3/4 ? 'default' : 'outline'}
              onClick={() => setCustomAspect(3/4)}
            >
              3:4
            </Button>
            <Button
              size="sm"
              variant={customAspect === 4/3 ? 'default' : 'outline'}
              onClick={() => setCustomAspect(4/3)}
            >
              4:3
            </Button>
            <Button
              size="sm"
              variant={customAspect === 16/9 ? 'default' : 'outline'}
              onClick={() => setCustomAspect(16/9)}
            >
              16:9
            </Button>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Масштаб</label>
            <Slider
              value={[zoom]}
              onValueChange={(value) => setZoom(value[0])}
              min={1}
              max={3}
              step={0.1}
              className="w-full"
            />
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