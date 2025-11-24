import { useState, useRef } from 'react';
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
  aspectRatio = 3 / 4
}: ImageCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCrop = () => {
    setIsProcessing(true);
    
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        setIsProcessing(false);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setIsProcessing(false);
        return;
      }

      const targetWidth = 800;
      const targetHeight = targetWidth / aspectRatio;

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const scale = Math.max(targetWidth / img.width, targetHeight / img.height);
      const scaledWidth = img.width * scale;
      const scaledHeight = img.height * scale;
      const x = (targetWidth - scaledWidth) / 2;
      const y = (targetHeight - scaledHeight) / 2;

      ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

      const croppedImage = canvas.toDataURL('image/jpeg', 0.9);
      onCropComplete(croppedImage);
      setIsProcessing(false);
    };
    
    img.onerror = () => {
      setIsProcessing(false);
    };
    
    img.src = image;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Обрезка изображения</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative w-full max-h-96 overflow-hidden rounded-lg border">
            <img 
              src={image} 
              alt="Crop preview" 
              className="w-full h-auto"
            />
          </div>
          
          <canvas ref={canvasRef} className="hidden" />
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={isProcessing}>
              Отмена
            </Button>
            <Button onClick={handleCrop} disabled={isProcessing}>
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
