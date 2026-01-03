import { useState } from 'react';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import ReplicateTryOnImageUpload from '@/components/replicate/ReplicateTryOnImageUpload';
import ReplicateTryOnClothingSelector from '@/components/replicate/ReplicateTryOnClothingSelector';
import ReplicateTryOnGenerator from '@/components/replicate/ReplicateTryOnGenerator';
import ReplicateSaveDialog from '@/components/replicate/ReplicateSaveDialog';
import { useCatalogFilters, useCatalog } from '@/hooks/useCatalog';

interface SelectedClothing {
  id: string;
  image: string;
  name?: string;
  category?: string;
  isFromCatalog?: boolean;
}

const DB_QUERY_API = 'https://functions.poehali.dev/59a0379b-a4b5-4cec-b2d2-884439f64df9';
const SAVE_IMAGE_FTP_API = 'https://functions.poehali.dev/56814ab9-6cba-4035-a63d-423ac0d301c8';

export default function ReplicateTryOn() {
  const { user } = useAuth();
  const { lookbooks, refetchLookbooks, refetchHistory } = useData();
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [selectedClothingItems, setSelectedClothingItems] = useState<SelectedClothing[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newLookbookName, setNewLookbookName] = useState('');
  const [newLookbookPersonName, setNewLookbookPersonName] = useState('');
  const [selectedLookbookId, setSelectedLookbookId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [selectedColors, setSelectedColors] = useState<number[]>([]);
  const [selectedArchetypes, setSelectedArchetypes] = useState<number[]>([]);
  const [selectedGender, setSelectedGender] = useState<string>('');
  const [showCategoryError, setShowCategoryError] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [cdnImageUrl, setCdnImageUrl] = useState<string | null>(null);

  const { data: filters, isLoading: filtersLoading } = useCatalogFilters(['Обувь', 'Аксессуары', 'Головные уборы']);
  const { data: clothingCatalog, isLoading: catalogLoading } = useCatalog({
    categoryIds: selectedCategories?.length > 0 ? selectedCategories : undefined,
    colorIds: selectedColors?.length > 0 ? selectedColors : undefined,
    archetypeIds: selectedArchetypes?.length > 0 ? selectedArchetypes : undefined,
    gender: selectedGender || undefined,
    includeReplicateCategories: ['upper_body', 'lower_body', 'dresses'],
  });

  const handleSaveToExistingLookbook = async () => {
    if (!selectedLookbookId || !user) return;

    if (!cdnImageUrl) {
      toast.error('Изображение ещё сохраняется, подождите...');
      return;
    }

    setIsSaving(true);
    try {
      const lookbook = lookbooks?.find(lb => lb.id === selectedLookbookId);
      const updatedPhotos = [...(lookbook?.photos || []), cdnImageUrl];

      const response = await fetch(DB_QUERY_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': user.id
        },
        body: JSON.stringify({
          table: 'lookbooks',
          action: 'update',
          where: { id: selectedLookbookId },
          data: { photos: updatedPhotos }
        })
      });

      if (response.ok) {
        toast.success('Фото добавлено в лукбук!');
        setShowSaveDialog(false);
        setSelectedLookbookId('');
        await refetchLookbooks();
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      toast.error('Ошибка сохранения');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveToNewLookbook = async () => {
    if (!newLookbookName || !newLookbookPersonName || !user) return;

    if (!cdnImageUrl) {
      toast.error('Изображение ещё сохраняется, подождите...');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(DB_QUERY_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': user.id
        },
        body: JSON.stringify({
          table: 'lookbooks',
          action: 'insert',
          data: {
            user_id: user.id,
            name: newLookbookName,
            person_name: newLookbookPersonName,
            photos: [cdnImageUrl],
            color_palette: []
          }
        })
      });

      if (response.ok) {
        toast.success('Лукбук создан!');
        setShowSaveDialog(false);
        setNewLookbookName('');
        setNewLookbookPersonName('');
        await refetchLookbooks();
      } else {
        throw new Error('Failed to create lookbook');
      }
    } catch (error) {
      toast.error('Ошибка создания лукбука');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadImage = async () => {
    if (!generatedImage) return;

    try {
      let blob: Blob;
      
      if (generatedImage.startsWith('data:')) {
        const response = await fetch(generatedImage);
        blob = await response.blob();
      } else {
        const response = await fetch(generatedImage);
        if (!response.ok) {
          throw new Error('Failed to fetch image');
        }
        blob = await response.blob();
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `outfit-${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Изображение скачано!');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Ошибка скачивания изображения');
    }
  };

  const handleSaveImageToFtp = async () => {
    if (!cdnImageUrl || !user) {
      toast.error('Изображение не готово для сохранения');
      return;
    }

    try {
      const response = await fetch(SAVE_IMAGE_FTP_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': user.id,
        },
        body: JSON.stringify({
          image_url: cdnImageUrl,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save to FTP');
      }

      const data = await response.json();
      toast.success('Изображение сохранено на FTP сервер!');
      console.log('FTP URL:', data.ftp_url);
    } catch (error) {
      console.error('FTP save error:', error);
      toast.error('Ошибка сохранения на FTP');
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Виртуальная примерочная</h1>
            <p className="text-muted-foreground">
              Загрузите фото модели и выберите одежду для примерки
            </p>
          </div>
          <Link to="/profile/history">
            <Button variant="outline">
              История примерок
            </Button>
          </Link>
        </div>

        {filtersLoading || catalogLoading || !filters || !clothingCatalog ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Загрузка каталога...</p>
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <ReplicateTryOnImageUpload
                uploadedImage={uploadedImage}
                onImageChange={setUploadedImage}
              />

              <ReplicateTryOnClothingSelector
                selectedClothingItems={selectedClothingItems}
                onClothingItemsChange={setSelectedClothingItems}
                filters={filters}
                clothingCatalog={clothingCatalog}
                selectedCategories={selectedCategories}
                onSelectedCategoriesChange={setSelectedCategories}
                selectedColors={selectedColors}
                onSelectedColorsChange={setSelectedColors}
                selectedArchetypes={selectedArchetypes}
                onSelectedArchetypesChange={setSelectedArchetypes}
                selectedGender={selectedGender}
                onSelectedGenderChange={setSelectedGender}
                showCategoryError={showCategoryError}
              />
            </div>

            <div>
              <ReplicateTryOnGenerator
                user={user}
                uploadedImage={uploadedImage}
                selectedClothingItems={selectedClothingItems}
                onRefetchHistory={refetchHistory}
              />
            </div>
          </div>
        )}
      </div>

      <ReplicateSaveDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        lookbooks={lookbooks}
        selectedLookbookId={selectedLookbookId}
        onSelectedLookbookIdChange={setSelectedLookbookId}
        newLookbookName={newLookbookName}
        onNewLookbookNameChange={setNewLookbookName}
        newLookbookPersonName={newLookbookPersonName}
        onNewLookbookPersonNameChange={setNewLookbookPersonName}
        isSaving={isSaving}
        onSaveToExistingLookbook={handleSaveToExistingLookbook}
        onSaveToNewLookbook={handleSaveToNewLookbook}
        generatedImage={generatedImage}
        onDownloadImage={handleDownloadImage}
        onSaveImageToFtp={handleSaveImageToFtp}
      />
    </Layout>
  );
}