import { useState, useRef } from 'react';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';

interface ImageCropperProps {
  image: string;
  open: boolean;
  onClose: () => void;
  onCropComplete: (croppedImage: string) => void;
  aspectRatio?: number;
}

export default function ImageCropper({
  image,
  open,
  onClose,
  onCropComplete,
  aspectRatio
}: ImageCropperProps) {
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    width: 90,
    height: 90,
    x: 5,
    y: 5
  });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCropComplete = async () => {
    if (!imgRef.current) {
      return;
    }

    if (!imgRef.current.complete || imgRef.current.naturalWidth === 0) {
      return;
    }

    const cropToUse = completedCrop || {
      x: (crop.x / 100) * imgRef.current.width,
      y: (crop.y / 100) * imgRef.current.height,
      width: (crop.width / 100) * imgRef.current.width,
      height: (crop.height / 100) * imgRef.current.height,
    };

    if (cropToUse.width <= 0 || cropToUse.height <= 0) {
      return;
    }

    setIsProcessing(true);

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      const loadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
        img.onload = () => resolve(img);
        img.onerror = reject;
      });
      
      img.src = image;
      
      const loadedImg = await loadPromise;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setIsProcessing(false);
        return;
      }

      const scaleX = loadedImg.naturalWidth / imgRef.current.width;
      const scaleY = loadedImg.naturalHeight / imgRef.current.height;

      canvas.width = Math.floor(cropToUse.width * scaleX);
      canvas.height = Math.floor(cropToUse.height * scaleY);

      ctx.drawImage(
        loadedImg,
        Math.floor(cropToUse.x * scaleX),
        Math.floor(cropToUse.y * scaleY),
        Math.floor(cropToUse.width * scaleX),
        Math.floor(cropToUse.height * scaleY),
        0,
        0,
        Math.floor(cropToUse.width * scaleX),
        Math.floor(cropToUse.height * scaleY)
      );

      const croppedImage = canvas.toDataURL('image/jpeg', 0.95);
      setIsProcessing(false);
      onCropComplete(croppedImage);
    } catch (error) {
      console.error('Error cropping image:', error);
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Обрезка изображения</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {aspectRatio && aspectRatio < 1 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <Icon name="Info" className="text-blue-600 mt-0.5 flex-shrink-0" size={18} />
                <div className="text-sm text-blue-900">
                  <p className="font-medium mb-1">Рекомендация по формату</p>
                  <p className="text-blue-700">
                    Для корректной работы примерочной используйте вертикальные фото (высота больше ширины). 
                    Обрежьте изображение так, чтобы получился вертикальный формат.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="flex justify-center">
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={aspectRatio}
              className="max-h-[600px]"
            >
              <img
                ref={imgRef}
                src={image}
                alt="Crop preview"
                className="max-w-full h-auto"
              />
            </ReactCrop>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={isProcessing}>
              Отмена
            </Button>
            <Button onClick={handleCropComplete} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Icon name="Loader2" className="mr-2 animate-spin" size={16} />
                  Обработка...
                </>
              ) : (
                <>
                  <Icon name="Check" className="mr-2" size={16} />
                  Применить
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}