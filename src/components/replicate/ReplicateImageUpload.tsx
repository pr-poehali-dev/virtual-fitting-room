import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import ImageViewer from '@/components/ImageViewer';
import { useRef } from 'react';

interface ReplicateImageUploadProps {
  uploadedImage: string | null;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isGenerating: boolean;
  mode: 'upload' | 'model';
  onModeChange: (mode: 'upload' | 'model') => void;
  onOpenModelDialog: () => void;
  isModelLoading: boolean;
  modelSwitchDisabled: boolean;
  modelSwitchHint?: string;
}

export default function ReplicateImageUpload({
  uploadedImage,
  handleImageUpload,
  isGenerating,
  mode,
  onModeChange,
  onOpenModelDialog,
  isModelLoading,
  modelSwitchDisabled,
  modelSwitchHint,
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
      <Label className="text-lg font-semibold mb-2 block">
        <Icon name="User" className="inline mr-2" size={20} />
        1. Фото человека
      </Label>

      <div className="inline-flex rounded-lg border border-gray-200 p-1 mb-3 bg-gray-50">
        <button
          type="button"
          onClick={() => onModeChange('upload')}
          disabled={isGenerating || isModelLoading}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            mode === 'upload'
              ? 'bg-white shadow-sm font-medium text-primary'
              : 'text-gray-500 hover:text-gray-700'
          } ${isGenerating || isModelLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Icon name="Upload" className="inline mr-1" size={14} />
          Своё фото
        </button>
        <button
          type="button"
          onClick={() => !modelSwitchDisabled && onModeChange('model')}
          disabled={isGenerating || isModelLoading || modelSwitchDisabled}
          title={modelSwitchDisabled ? modelSwitchHint : undefined}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            mode === 'model'
              ? 'bg-white shadow-sm font-medium text-primary'
              : 'text-gray-500 hover:text-gray-700'
          } ${
            isGenerating || isModelLoading || modelSwitchDisabled
              ? 'opacity-50 cursor-not-allowed'
              : ''
          }`}
        >
          <Icon name="Sparkles" className="inline mr-1" size={14} />
          Создать модель
        </button>
      </div>

      {modelSwitchDisabled && modelSwitchHint && (
        <p className="text-xs text-orange-600 mb-2">{modelSwitchHint}</p>
      )}

      <p className="text-sm text-muted-foreground mb-3">
        На которого хотите примерить одежду
      </p>

      {mode === 'model' && uploadedImage && !isModelLoading && (
        <button
          type="button"
          onClick={onOpenModelDialog}
          disabled={isGenerating}
          className="mb-3 text-sm text-primary hover:text-primary/80 inline-flex items-center"
        >
          <Icon name="RefreshCw" className="mr-1" size={14} />
          Выбрать другую модель
        </button>
      )}

      {isModelLoading ? (
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-primary rounded-lg p-8 bg-primary/5 min-h-[260px]">
          <Icon name="Loader2" size={48} className="text-primary mb-4 animate-spin" />
          <p className="text-sm text-gray-600 text-center font-medium">
            Создаём модель...
          </p>
          <p className="text-xs text-gray-500 text-center mt-2">
            Это займёт до минуты
          </p>
        </div>
      ) : mode === 'model' && !uploadedImage ? (
        <button
          type="button"
          onClick={onOpenModelDialog}
          disabled={isGenerating}
          className="w-full flex flex-col items-center justify-center border-2 border-dashed border-primary rounded-lg p-8 bg-primary/5 hover:bg-primary/10 transition-colors min-h-[260px]"
        >
          <Icon name="Sparkles" size={48} className="text-primary mb-4" />
          <p className="text-sm text-gray-700 text-center font-medium">
            Создать модель по описанию
          </p>
          <p className="text-xs text-gray-500 text-center mt-2">
            Опишите внешность — мы сгенерируем модель в полный рост
          </p>
        </button>
      ) : (
        <div className="relative">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
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
                <div className="mt-4 text-center">
                  <span className="inline-flex items-center text-sm font-medium text-primary hover:text-primary/80 transition-colors">
                    <Icon name="Upload" className="mr-2" size={16} />
                    Заменить фото
                  </span>
                </div>
              </div>
            ) : (
              <>
                <Icon name="Upload" size={48} className="text-gray-400 mb-4" />
                <p className="text-sm text-gray-600 text-center font-medium">
                  Нажмите для загрузки фото
                </p>
                <p className="text-xs text-gray-500 text-center mt-2">
                  Модель в полный рост на светлом фоне
                </p>
              </>
            )}
          </label>
        </div>
      )}
    </div>
  );
}