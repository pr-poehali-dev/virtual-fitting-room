import { toast } from 'sonner';

interface User {
  id: string;
  email: string;
  name: string;
}

export const saveToExistingLookbook = async (
  selectedLookbookId: string,
  generatedImage: string | null,
  user: User | null,
  lookbooks: any[],
  setIsSaving: (saving: boolean) => void,
  setShowSaveDialog: (show: boolean) => void,
  setSelectedLookbookId: (id: string) => void,
  fetchLookbooks: () => Promise<void>
): Promise<void> => {
  if (!selectedLookbookId || !generatedImage || !user) return;

  setIsSaving(true);
  try {
    const lookbook = lookbooks.find(lb => lb.id === selectedLookbookId);
    const updatedPhotos = [...(lookbook?.photos || []), generatedImage];

    const response = await fetch('https://functions.poehali.dev/69de81d7-5596-4e1d-bbd3-4b3e1a520d6b', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': user.id
      },
      body: JSON.stringify({
        id: selectedLookbookId,
        photos: updatedPhotos
      })
    });

    if (response.ok) {
      toast.success('Фото добавлено в лукбук!');
      setShowSaveDialog(false);
      setSelectedLookbookId('');
      await fetchLookbooks();
    } else {
      throw new Error('Failed to save');
    }
  } catch (error) {
    toast.error('Ошибка сохранения');
  } finally {
    setIsSaving(false);
  }
};

export const saveToNewLookbook = async (
  newLookbookName: string,
  newLookbookPersonName: string,
  generatedImage: string | null,
  user: User | null,
  setIsSaving: (saving: boolean) => void,
  setShowSaveDialog: (show: boolean) => void,
  setNewLookbookName: (name: string) => void,
  setNewLookbookPersonName: (name: string) => void,
  fetchLookbooks: () => Promise<void>
): Promise<void> => {
  if (!newLookbookName || !newLookbookPersonName || !generatedImage || !user) return;

  setIsSaving(true);
  try {
    const response = await fetch('https://functions.poehali.dev/69de81d7-5596-4e1d-bbd3-4b3e1a520d6b', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': user.id
      },
      body: JSON.stringify({
        name: newLookbookName,
        person_name: newLookbookPersonName,
        photos: [generatedImage],
        color_palette: []
      })
    });

    if (response.ok) {
      toast.success('Лукбук создан!');
      setShowSaveDialog(false);
      setNewLookbookName('');
      setNewLookbookPersonName('');
      await fetchLookbooks();
    } else {
      throw new Error('Failed to create lookbook');
    }
  } catch (error) {
    toast.error('Ошибка создания лукбука');
  } finally {
    setIsSaving(false);
  }
};
