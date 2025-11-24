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
    console.log('=== handleCropComplete called ===');
    console.log('imgRef.current:', imgRef.current);
    console.log('crop:', crop);
    console.log('completedCrop:', completedCrop);
    
    if (!imgRef.current) {
      console.error('No image reference');
      return;
    }

    console.log('Image loaded:', imgRef.current.complete);
    console.log('Natural dimensions:', imgRef.current.naturalWidth, 'x', imgRef.current.naturalHeight);
    console.log('Display dimensions:', imgRef.current.width, 'x', imgRef.current.height);

    if (!imgRef.current.complete || imgRef.current.naturalWidth === 0) {
      console.error('Image not loaded yet');
      return;
    }

    const cropToUse = completedCrop || {
      x: (crop.x / 100) * imgRef.current.width,
      y: (crop.y / 100) * imgRef.current.height,
      width: (crop.width / 100) * imgRef.current.width,
      height: (crop.height / 100) * imgRef.current.height,
    };

    console.log('cropToUse:', cropToUse);

    if (cropToUse.width <= 0 || cropToUse.height <= 0) {
      console.error('Invalid crop dimensions:', cropToUse);
      return;
    }

    console.log('Starting crop process...');
    setIsProcessing(true);

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('Failed to get canvas context');
        setIsProcessing(false);
        return;
      }

      const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
      const scaleY = imgRef.current.naturalHeight / imgRef.current.height;

      console.log('Scale:', scaleX, scaleY);

      canvas.width = Math.floor(cropToUse.width * scaleX);
      canvas.height = Math.floor(cropToUse.height * scaleY);

      console.log('Canvas size:', canvas.width, 'x', canvas.height);

      ctx.drawImage(
        imgRef.current,
        Math.floor(cropToUse.x * scaleX),
        Math.floor(cropToUse.y * scaleY),
        Math.floor(cropToUse.width * scaleX),
        Math.floor(cropToUse.height * scaleY),
        0,
        0,
        Math.floor(cropToUse.width * scaleX),
        Math.floor(cropToUse.height * scaleY)
      );

      console.log('Drawing complete, converting to data URL...');
      const croppedImage = canvas.toDataURL('image/jpeg', 0.95);
      console.log('Data URL created, length:', croppedImage.length);
      
      setIsProcessing(false);
      console.log('Calling onCropComplete...');
      onCropComplete(croppedImage);
      console.log('onCropComplete called successfully');
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