import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';

interface ImageViewerProps {
  src: string;
  alt?: string;
  className?: string;
}

export default function ImageViewer({ src, alt = '', className = '' }: ImageViewerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="relative group">
        <img src={src} alt={alt} className={className} />
        <button
          onClick={() => setIsOpen(true)}
          className="absolute top-2 left-2 bg-black/50 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70 cursor-pointer"
          title="Увеличить изображение"
        >
          <Icon name="ZoomIn" size={16} />
        </button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <img src={src} alt={alt} className="w-full h-auto max-h-[85vh] object-contain" />
        </DialogContent>
      </Dialog>
    </>
  );
}