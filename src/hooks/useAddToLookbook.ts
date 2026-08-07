import { useState } from 'react';
import { toast } from 'sonner';
import { useData } from '@/context/DataContext';

const DB_QUERY_API = 'https://functions.poehali.dev/59a0379b-a4b5-4cec-b2d2-884439f64df9';

export interface ProductLink {
  name: string;
  product_url: string;
}

/** Фото, которое добавляем в лукбук. products — необязательны (у генераций их нет). */
export interface LookbookPhoto {
  url: string;
  products?: ProductLink[];
}

/**
 * Общая логика добавления фото в лукбук.
 * Используется историей примерок и историей генераций,
 * подходит для любого нового раздела.
 */
export function useAddToLookbook() {
  const { lookbooks, refetchLookbooks } = useData();
  const [selectedLookbookId, setSelectedLookbookId] = useState<string>('');
  const [isAdding, setIsAdding] = useState(false);

  const addToLookbook = async (photos: LookbookPhoto[]): Promise<boolean> => {
    if (photos.length === 0) {
      toast.error('Выберите фото для добавления');
      return false;
    }

    if (!selectedLookbookId) {
      toast.error('Выберите лукбук');
      return false;
    }

    setIsAdding(true);
    try {
      const lookbook = lookbooks.find((lb) => lb.id === selectedLookbookId);
      if (!lookbook) {
        toast.error('Лукбук не найден');
        return false;
      }

      const photoUrls = photos.map((p) => p.url);
      const updatedPhotos = [...lookbook.photos, ...photoUrls];

      const updatedPhotoProducts = { ...(lookbook.photo_products || {}) };
      photos.forEach((photo) => {
        if (photo.products && photo.products.length > 0) {
          updatedPhotoProducts[photo.url] = photo.products;
        }
      });

      const token = localStorage.getItem('session_token');
      const response = await fetch(DB_QUERY_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'X-Session-Token': token } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          table: 'lookbooks',
          action: 'update',
          where: { id: selectedLookbookId },
          data: { photos: updatedPhotos, photo_products: updatedPhotoProducts },
        }),
      });

      if (!response.ok) throw new Error('Failed to update lookbook');

      toast.success(`Добавлено ${photoUrls.length} фото в лукбук`);
      setSelectedLookbookId('');
      await refetchLookbooks();
      return true;
    } catch (error) {
      console.error('Failed to add to lookbook:', error);
      toast.error('Ошибка добавления в лукбук');
      return false;
    } finally {
      setIsAdding(false);
    }
  };

  return {
    lookbooks,
    selectedLookbookId,
    setSelectedLookbookId,
    isAdding,
    addToLookbook,
  };
}
