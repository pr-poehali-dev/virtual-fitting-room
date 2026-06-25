import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import ImageViewer from '@/components/ImageViewer';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';

interface Lookbook {
  id: string;
  name: string;
  person_name: string;
  photos: string[];
  color_palette: string[];
  is_public?: boolean;
  share_token?: string;
  created_at: string;
  updated_at: string;
  photo_products?: Record<string, { name: string; product_url: string }[]>;
}

interface LookbookViewerDialogProps {
  lookbook: Lookbook | null;
  onClose: () => void;
  imageProxyApi: string;
}

export default function LookbookViewerDialog({ lookbook, onClose, imageProxyApi }: LookbookViewerDialogProps) {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const handleDownloadPDF = async () => {
    if (!lookbook) return;
    
    setIsGeneratingPDF(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const usableWidth = pageWidth - 2 * margin;
      
      const encodeText = (text: string) => {
        const chars: { [key: string]: string } = {
          'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo', 'Ж': 'Zh',
          'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O',
          'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts',
          'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch', 'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya',
          'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
          'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
          'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
          'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
        };
        return text.split('').map(char => chars[char] || char).join('');
      };
      
      pdf.setFontSize(24);
      pdf.text(encodeText(lookbook.name), margin, margin + 10);
      
      pdf.setFontSize(14);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`For: ${encodeText(lookbook.person_name)}`, margin, margin + 20);
      
      let yPos = margin + 35;
      
      const colorSize = 8;
      const colorGap = 2;
      let colorX = margin;
      lookbook.color_palette.forEach((color) => {
        if (colorX + colorSize > pageWidth - margin) {
          colorX = margin;
          yPos += colorSize + colorGap;
        }
        const hex = color.replace('#', '').slice(0, 6);
        pdf.setFillColor(
          parseInt(hex.slice(0, 2), 16),
          parseInt(hex.slice(2, 4), 16),
          parseInt(hex.slice(4, 6), 16)
        );
        pdf.rect(colorX, yPos, colorSize, colorSize, 'F');
        colorX += colorSize + colorGap;
      });
      
      yPos += colorSize + 12;
      
      const loadImage = async (url: string): Promise<string> => {
        console.log('[PDF] Loading image:', url);
        try {
          if (url.startsWith('data:')) {
            console.log('[PDF] Image is already base64');
            return url;
          }

          console.log('[PDF] Using image proxy for:', url);
          const proxyUrl = `${imageProxyApi}?url=${encodeURIComponent(url)}`;
          const response = await fetch(proxyUrl);
          
          if (!response.ok) {
            throw new Error(`Proxy failed: HTTP ${response.status}`);
          }
          
          const data = await response.json();
          console.log('[PDF] Image loaded via proxy, size:', data.data_url.length);
          
          return data.data_url;
        } catch (error) {
          console.error('[PDF] Error loading image:', url, error);
          throw error;
        }
      };
      
      const getImageSize = (dataUrl: string): Promise<{ width: number; height: number }> =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
          img.onerror = () => resolve({ width: 5, height: 7 });
          img.src = dataUrl;
        });

      const photos = lookbook.photos;
      const cellWidth = usableWidth / 3;
      const gap = 3;
      const imageWidth = cellWidth - gap;
      const imageHeight = imageWidth * 1.4;
      const linkLineHeight = 4;
      const maxLinksPerPhoto = 3;

      // Высота блока ссылок под рядом = максимум ссылок среди фото этого ряда
      const rowLinksHeight = (rowStart: number) => {
        let maxLinks = 0;
        for (let k = rowStart; k < Math.min(rowStart + 3, photos.length); k++) {
          const links = lookbook.photo_products?.[photos[k]] || [];
          maxLinks = Math.max(maxLinks, Math.min(links.length, maxLinksPerPhoto));
        }
        return maxLinks > 0 ? maxLinks * linkLineHeight + 2 : 0;
      };

      let currentX = margin;
      let currentY = yPos;
      let photosInRow = 0;
      let rowStartIndex = 0;

      for (let i = 0; i < photos.length; i++) {
        const blockHeight = imageHeight + rowLinksHeight(rowStartIndex);
        if (currentY + blockHeight > pageHeight - margin) {
          pdf.addPage();
          currentY = margin;
          currentX = margin;
          photosInRow = 0;
          rowStartIndex = i;
        }

        try {
          const imgData = await loadImage(photos[i]);
          const { width: natW, height: natH } = await getImageSize(imgData);

          // Вписываем картинку в ячейку с сохранением пропорций (contain), центрируем
          const scale = Math.min(imageWidth / natW, imageHeight / natH);
          const drawW = natW * scale;
          const drawH = natH * scale;
          const offsetX = currentX + (imageWidth - drawW) / 2;
          const offsetY = currentY + (imageHeight - drawH) / 2;

          pdf.addImage(imgData, 'JPEG', offsetX, offsetY, drawW, drawH, undefined, 'FAST');
        } catch (e) {
          console.error('Failed to load image:', e);
        }

        // Ссылки на товары под фото
        const links = (lookbook.photo_products?.[photos[i]] || []).slice(0, maxLinksPerPhoto);
        if (links.length > 0) {
          pdf.setFontSize(7);
          pdf.setTextColor(124, 58, 237);
          links.forEach((link, li) => {
            const label = encodeText(link.name).slice(0, 30) || 'WB';
            const ly = currentY + imageHeight + 3 + li * linkLineHeight;
            pdf.textWithLink(label, currentX, ly, { url: link.product_url });
          });
          pdf.setTextColor(0, 0, 0);
        }

        photosInRow++;

        if (photosInRow === 3 || i === photos.length - 1) {
          currentX = margin;
          currentY += imageHeight + rowLinksHeight(rowStartIndex) + gap;
          photosInRow = 0;
          rowStartIndex = i + 1;
        } else {
          currentX += cellWidth;
        }
      }
      
      pdf.save(`${encodeText(lookbook.name)}.pdf`);
      toast.success('PDF скачан!');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Ошибка создания PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <Dialog open={!!lookbook} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-light">{lookbook?.name}</h2>
              <p className="text-sm text-muted-foreground mt-1">Для: {lookbook?.person_name}</p>
            </div>
            <Button 
              onClick={handleDownloadPDF} 
              disabled={isGeneratingPDF}
              size="sm"
              className="mr-5"
            >
              {isGeneratingPDF ? (
                <>
                  <Icon name="Loader2" className="mr-2 animate-spin" size={16} />
                  Создание PDF...
                </>
              ) : (
                <>
                  <Icon name="Download" className="mr-2" size={16} />
                  Скачать PDF
                </>
              )}
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        {lookbook && (
          <div className="space-y-6 py-4">
            <div>
              <h3 className="text-sm font-medium mb-3">Цветовая палитра</h3>
              <div className="flex gap-3 flex-wrap">
                {lookbook.color_palette.map((color, index) => (
                  <div
                    key={index}
                    className="w-14 h-14 rounded-lg shadow-md"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            {lookbook.photos.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-3">Результаты примерок</h3>
                <div className="grid grid-cols-3 gap-3">
                  {lookbook.photos.map((photo, index) => {
                    const links = lookbook.photo_products?.[photo] || [];
                    return (
                      <div key={index} className="space-y-1">
                        <div className="relative rounded-lg overflow-hidden bg-muted aspect-[5/7]">
                          <ImageViewer
                            src={photo}
                            alt={`Photo ${index + 1}`}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        {links.length > 0 && (
                          <div className="space-y-0.5">
                            {links.map((link, i) => (
                              <a
                                key={i}
                                href={link.product_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 truncate"
                                title={link.name}
                              >
                                <Icon name="ExternalLink" size={12} className="flex-shrink-0" />
                                <span className="truncate">{link.name}</span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}