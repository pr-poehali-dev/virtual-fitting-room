import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Icon from '@/components/ui/icon';

interface LookbookOption {
  id: string;
  name: string;
}

interface AddToLookbookBarProps {
  selectedCount: number;
  lookbooks: LookbookOption[];
  selectedLookbookId: string;
  onLookbookChange: (id: string) => void;
  isAdding: boolean;
  onAdd: () => void;
  onDelete?: () => void;
  onCancel: () => void;
}

/**
 * Панель действий над выбранными фото: добавить в лукбук, удалить, отменить.
 * Общая для истории примерок и истории генераций.
 */
export default function AddToLookbookBar({
  selectedCount,
  lookbooks,
  selectedLookbookId,
  onLookbookChange,
  isAdding,
  onAdd,
  onDelete,
  onCancel,
}: AddToLookbookBarProps) {
  if (selectedCount === 0) return null;

  return (
    <Card className="bg-blue-50 border-blue-200">
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="flex-1">
            <p className="font-medium text-blue-900">Выбрано: {selectedCount}</p>
            <p className="text-sm text-blue-700">
              Добавьте выбранные фото в лукбук
            </p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <Select value={selectedLookbookId} onValueChange={onLookbookChange}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Выберите лукбук" />
              </SelectTrigger>
              <SelectContent>
                {lookbooks.map((lb) => (
                  <SelectItem key={lb.id} value={lb.id}>
                    {lb.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={onAdd} disabled={isAdding || !selectedLookbookId}>
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
            {onDelete && (
              <Button variant="destructive" onClick={onDelete}>
                <Icon name="Trash2" className="mr-2" size={16} />
                Удалить
              </Button>
            )}
            <Button variant="outline" onClick={onCancel}>
              Отменить
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
