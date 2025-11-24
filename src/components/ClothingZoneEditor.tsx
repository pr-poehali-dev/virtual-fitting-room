import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

interface ClothingZone {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ClothingZoneEditorProps {
  personImage: string;
  clothingImage: string;
  clothingName?: string;
  onSave: (zone: ClothingZone) => void;
  onClose: () => void;
  existingZone?: ClothingZone;
}

export default function ClothingZoneEditor({ 
  personImage, 
  clothingImage,
  clothingName,
  onSave, 
  onClose,
  existingZone 
}: ClothingZoneEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [zone, setZone] = useState<ClothingZone | null>(existingZone || null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentPoint, setCurrentPoint] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const maxWidth = 500;
      const maxHeight = 400;
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }

      canvas.width = width;
      canvas.height = height;

      if (imgRef.current) {
        imgRef.current.width = width;
        imgRef.current.height = height;
      }

      drawCanvas();
    };
    img.src = personImage;
    imgRef.current = img;
  }, [personImage]);

  useEffect(() => {
    drawCanvas();
  }, [zone, startPoint, currentPoint, isDrawing]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !img.complete) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    if (zone) {
      ctx.fillStyle = 'rgba(34, 197, 94, 0.25)';
      ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
      
      ctx.strokeStyle = 'rgba(34, 197, 94, 1)';
      ctx.lineWidth = 3;
      ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);

      ctx.fillStyle = 'white';
      ctx.font = 'bold 14px sans-serif';
      ctx.strokeStyle = 'rgba(34, 197, 94, 1)';
      ctx.lineWidth = 3;
      ctx.strokeText('Область примерки', zone.x + 8, zone.y + 20);
      ctx.fillText('Область примерки', zone.x + 8, zone.y + 20);
    }

    if (isDrawing && startPoint && currentPoint) {
      const width = currentPoint.x - startPoint.x;
      const height = currentPoint.y - startPoint.y;

      ctx.fillStyle = 'rgba(59, 130, 246, 0.25)';
      ctx.fillRect(startPoint.x, startPoint.y, width, height);
      
      ctx.strokeStyle = 'rgba(59, 130, 246, 1)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(startPoint.x, startPoint.y, width, height);
      ctx.setLineDash([]);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) * (canvas.width / rect.width));
    const y = ((e.clientY - rect.top) * (canvas.height / rect.height));

    setIsDrawing(true);
    setStartPoint({ x, y });
    setCurrentPoint({ x, y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) * (canvas.width / rect.width));
    const y = ((e.clientY - rect.top) * (canvas.height / rect.height));

    setCurrentPoint({ x, y });
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const endX = ((e.clientX - rect.left) * (canvas.width / rect.width));
    const endY = ((e.clientY - rect.top) * (canvas.height / rect.height));

    const width = endX - startPoint.x;
    const height = endY - startPoint.y;

    if (Math.abs(width) > 20 && Math.abs(height) > 20) {
      const newZone: ClothingZone = {
        x: Math.min(startPoint.x, endX),
        y: Math.min(startPoint.y, endY),
        width: Math.abs(width),
        height: Math.abs(height)
      };
      setZone(newZone);
    }

    setIsDrawing(false);
    setStartPoint(null);
    setCurrentPoint(null);
  };

  const handleSave = () => {
    if (!zone) return;
    onSave(zone);
  };

  const handleClear = () => {
    setZone(null);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <Card className="w-full max-w-5xl max-h-[90vh] overflow-y-auto p-6 my-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold">Укажите область примерки</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {clothingName ? `Для: ${clothingName}` : 'Нарисуйте область на фото где должна быть эта одежда'}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <Icon name="X" size={20} />
            </Button>
          </div>

          <div className="grid lg:grid-cols-[1fr,250px] gap-4">
            <div className="space-y-3">
              <div className="border rounded-lg overflow-hidden bg-muted/30">
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={() => {
                    if (isDrawing) {
                      setIsDrawing(false);
                      setStartPoint(null);
                      setCurrentPoint(null);
                    }
                  }}
                  className="cursor-crosshair w-full"
                  style={{ maxWidth: '100%', height: 'auto' }}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Одежда для примерки:</p>
                <div className="border rounded-lg p-2 bg-muted/30">
                  <img 
                    src={clothingImage} 
                    alt="Clothing" 
                    className="w-full h-32 object-contain rounded"
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="flex gap-2">
                  <Icon name="Info" className="text-blue-600 dark:text-blue-500 flex-shrink-0 mt-0.5" size={16} />
                  <div className="text-xs text-blue-800 dark:text-blue-300">
                    <p className="font-medium mb-1">Инструкция:</p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      <li>Нажмите и потяните мышкой</li>
                      <li>Отметьте область куда надеть</li>
                      <li>Для топа: грудь + плечи</li>
                      <li>Для брюк: талия до ног</li>
                      <li>Для обуви: ступни</li>
                      <li>Можно перерисовать</li>
                    </ul>
                  </div>
                </div>
              </div>

              {zone && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Область: {Math.round(zone.width)} × {Math.round(zone.height)} px
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Координаты: x={Math.round(zone.x)}, y={Math.round(zone.y)}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClear}
                    className="w-full"
                  >
                    <Icon name="Trash2" className="mr-2" size={14} />
                    Очистить
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={!zone}>
              <Icon name="Save" className="mr-2" size={16} />
              Сохранить область
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}