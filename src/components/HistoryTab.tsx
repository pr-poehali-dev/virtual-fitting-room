import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import ImageViewer from '@/components/ImageViewer';
import { toast } from 'sonner';

interface HistoryItem {
  id: string;
  person_image: string;
  garment_image: string;
  result_image: string;
  created_at: string;
}

interface Lookbook {
  id: string;
  name: string;
  person_name: string;
  photos: string[];
}

interface HistoryTabProps {
  userId: string;
}

const HISTORY_API = 'https://functions.poehali.dev/8436b2bf-ae39-4d91-b2b7-91951b4235cd';
const LOOKBOOKS_API = 'https://functions.poehali.dev/69de81d7-5596-4e1d-bbd3-4b3e1a520d6b';

export default function HistoryTab({ userId }: HistoryTabProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [lookbooks, setLookbooks] = useState<Lookbook[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectedLookbookId, setSelectedLookbookId] = useState<string>('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    console.log('[HistoryTab] userId received:', userId);
    fetchHistory();
    fetchLookbooks();
  }, [userId]);

  const fetchHistory = async () => {
    try {
      console.log('[HistoryTab] Fetching history with userId:', userId);
      const response = await fetch(HISTORY_API, {
        headers: {
          'X-User-Id': userId
        }
      });
      
      console.log('[HistoryTab] Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('[HistoryTab] Received data:', data);
        setHistory(Array.isArray(data) ? data : []);
      } else {
        const errorData = await response.json();
        console.error('[HistoryTab] Error response:', errorData);
        toast.error('Ошибка загрузки истории');
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
      toast.error('Ошибка загрузки истории');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLookbooks = async () => {
    try {
      const response = await fetch(LOOKBOOKS_API, {
        headers: {
          'X-User-Id': userId
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setLookbooks(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to fetch lookbooks:', error);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedItems.length === history.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(history.map(item => item.id));
    }
  };

  const handleAddToLookbook = async () => {
    if (selectedItems.length === 0) {
      toast.error('Выберите фото для добавления');
      return;
    }

    if (!selectedLookbookId) {
      toast.error('Выберите лукбук');
      return;
    }

    setIsAdding(true);
    try {
      const lookbook = lookbooks.find(lb => lb.id === selectedLookbookId);
      if (!lookbook) return;

      const selectedPhotos = history
        .filter(item => selectedItems.includes(item.id))
        .map(item => item.result_image);

      const updatedPhotos = [...lookbook.photos, ...selectedPhotos];

      const response = await fetch(LOOKBOOKS_API, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId
        },
        body: JSON.stringify({
          id: selectedLookbookId,
          photos: updatedPhotos
        })
      });

      if (response.ok) {
        toast.success(`Добавлено ${selectedPhotos.length} фото в лукбук`);
        setSelectedItems([]);
        setSelectedLookbookId('');
        await fetchLookbooks();
      } else {
        throw new Error('Failed to update lookbook');
      }
    } catch (error) {
      console.error('Failed to add to lookbook:', error);
      toast.error('Ошибка добавления в лукбук');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteFromHistory = async (id: string) => {
    if (!confirm('Удалить это фото из истории?')) return;

    try {
      const response = await fetch(`${HISTORY_API}?id=${id}`, {
        method: 'DELETE',
        headers: {
          'X-User-Id': userId
        }
      });

      if (response.ok) {
        toast.success('Фото удалено из истории');
        await fetchHistory();
      } else {
        throw new Error('Failed to delete');
      }
    } catch (error) {
      console.error('Failed to delete from history:', error);
      toast.error('Ошибка удаления');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Icon name="Loader2" className="animate-spin" size={48} />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-64">
          <Icon name="Image" size={48} className="text-gray-300 mb-4" />
          <p className="text-muted-foreground">История пуста</p>
          <p className="text-sm text-muted-foreground mt-2">
            Результаты генераций будут сохраняться здесь автоматически
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {selectedItems.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
              <div className="flex-1">
                <p className="font-medium text-blue-900">
                  Выбрано: {selectedItems.length}
                </p>
                <p className="text-sm text-blue-700">
                  Добавьте выбранные фото в лукбук
                </p>
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <Select value={selectedLookbookId} onValueChange={setSelectedLookbookId}>
                  <SelectTrigger className="w-full md:w-[200px]">
                    <SelectValue placeholder="Выберите лукбук" />
                  </SelectTrigger>
                  <SelectContent>
                    {lookbooks.map(lb => (
                      <SelectItem key={lb.id} value={lb.id}>
                        {lb.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  onClick={handleAddToLookbook} 
                  disabled={isAdding || !selectedLookbookId}
                >
                  {isAdding ? (
                    <>
                      <Icon name="Loader2" className="mr-2 animate-spin" size={16} />
                      Добавление...
                    </>
                  ) : (
                    <>
                      <Icon name="Plus" className="mr-2" size={16} />
                      Добавить
                    </>
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedItems([])}
                >
                  Отменить
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          size="sm"
          onClick={selectAll}
        >
          {selectedItems.length === history.length ? 'Снять выделение' : 'Выбрать все'}
        </Button>
        <p className="text-sm text-muted-foreground">
          Всего: {history.length}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {history.map((item) => (
          <Card 
            key={item.id} 
            className={`relative overflow-hidden transition-all ${
              selectedItems.includes(item.id) 
                ? 'ring-2 ring-primary' 
                : ''
            }`}
          >
            <CardContent className="p-0">
              <div className="relative">
                <ImageViewer
                  src={item.result_image}
                  alt="История примерки"
                  className="w-full aspect-[3/4] object-cover"
                />
                <div className="absolute top-2 right-2">
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDeleteFromHistory(item.id)}
                  >
                    <Icon name="Trash2" size={14} />
                  </Button>
                </div>
              </div>
              <div className="p-2 bg-muted space-y-2">
                <div className="flex items-center gap-2 justify-center">
                  <Checkbox
                    checked={selectedItems.includes(item.id)}
                    onCheckedChange={() => toggleSelection(item.id)}
                    id={`history-checkbox-${item.id}`}
                  />
                  <label 
                    htmlFor={`history-checkbox-${item.id}`}
                    className="text-xs text-muted-foreground cursor-pointer select-none"
                  >
                    Выбрать фото
                  </label>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  {new Date(item.created_at).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Icon name="Info" className="text-amber-600 mt-0.5 flex-shrink-0" size={20} />
            <div>
              <p className="text-sm font-medium text-amber-900">
                Автоматическое удаление
              </p>
              <p className="text-sm text-amber-700 mt-1">
                Фото в истории хранятся 6 месяцев, после чего автоматически удаляются. 
                Если хотите сохранить фото надолго - добавьте их в лукбук.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}