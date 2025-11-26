import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import ImageViewer from '@/components/ImageViewer';
import { Button } from '@/components/ui/button';
import { useRef } from 'react';

interface ReplicateImageUploadProps {
  uploadedImage: string | null;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isGenerating: boolean;
}

export default function ReplicateImageUpload({
  uploadedImage,
  handleImageUpload,
  isGenerating
}: ReplicateImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleImageUpload(e);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div>
      <Label className="text-lg font-semibold mb-4 block">
        <Icon name="User" className="inline mr-2" size={20} />
        1. Загрузите фото модели
      </Label>
      <div className="relative">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          id="model-upload"
          disabled={isGenerating}
        />
        <label
          htmlFor="model-upload"
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer transition-colors ${
            uploadedImage
              ? 'border-primary bg-primary/5'
              : 'border-gray-300 hover:border-primary'
          } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {uploadedImage ? (
            <div className="relative w-full">
              <ImageViewer src={uploadedImage} alt="Uploaded" className="rounded-lg" />
              <div className="mt-2 text-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isGenerating}
                >
                  <Icon name="Upload" className="mr-2" size={16} />
                  Заменить фото
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Icon name="Upload" size={48} className="text-gray-400 mb-4" />
              <p className="text-sm text-gray-600 text-center">
                Нажмите для загрузки фото
              </p>
            </>
          )}
        </label>
      </div>
    </div>
  );
}