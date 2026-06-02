import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { normalizeHex } from '@/utils/getColorTypePalette';

const LOOKBOOKS_API = 'https://functions.poehali.dev/69de81d7-5596-4e1d-bbd3-4b3e1a520d6b';
const MAX_COLORS = 36;

interface Lookbook {
  id: string;
  name: string;
  person_name: string;
  color_palette?: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  colors: string[];
}

export default function AddColorsToLookbookDialog({ open, onOpenChange, colors }: Props) {
  const [lookbooks, setLookbooks] = useState<Lookbook[]>([]);
  const [selectedLookbookId, setSelectedLookbookId] = useState('');
  const [newLookbookName, setNewLookbookName] = useState('');
  const [newLookbookPersonName, setNewLookbookPersonName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const normalizedColors = colors.map(normalizeHex);

  useEffect(() => {
    if (open) {
      fetchLookbooks();
    }
  }, [open]);

  const getToken = () => localStorage.getItem('session_token');

  const fetchLookbooks = async () => {
    try {
      const token = getToken();
      const response = await fetch(LOOKBOOKS_API, {
        headers: token ? { 'X-Session-Token': token } : {},
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setLookbooks(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to fetch lookbooks:', error);
    }
  };

  const mergeColors = (existing: string[]): string[] => {
    const seen = new Set<string>();
    const merged: string[] = [];
    [...(existing || []), ...normalizedColors].forEach((c) => {
      const h = normalizeHex(c);
      if (!seen.has(h)) {
        seen.add(h);
        merged.push(h);
      }
    });
    return merged.slice(0, MAX_COLORS);
  };

  const handleAddToExisting = async () => {
    if (!selectedLookbookId) return;
    setIsSaving(true);
    try {
      const token = getToken();
      const target = lookbooks.find((l) => l.id === selectedLookbookId);
      const merged = mergeColors(target?.color_palette || []);

      const response = await fetch(LOOKBOOKS_API, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'X-Session-Token': token } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ id: selectedLookbookId, color_palette: merged }),
      });
      if (!response.ok) throw new Error('Failed');
      toast.success('Цвета добавлены в лукбук');
      onOpenChange(false);
    } catch {
      toast.error('Не удалось добавить цвета');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNew = async () => {
    if (!newLookbookName || !newLookbookPersonName) return;
    setIsSaving(true);
    try {
      const token = getToken();
      const response = await fetch(LOOKBOOKS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'X-Session-Token': token } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          name: newLookbookName,
          person_name: newLookbookPersonName,
          photos: [],
          color_palette: normalizedColors.slice(0, MAX_COLORS),
        }),
      });
      if (!response.ok) throw new Error('Failed');
      toast.success('Лукбук создан, цвета добавлены');
      setNewLookbookName('');
      setNewLookbookPersonName('');
      onOpenChange(false);
    } catch {
      toast.error('Не удалось создать лукбук');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Добавить цвета в лукбук</DialogTitle>
          <DialogDescription>
            Добавьте палитру цветотипа в существующий лукбук или создайте новый
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <Label className="text-sm font-medium">Цвета для добавления ({normalizedColors.length})</Label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {normalizedColors.map((hex, i) => (
                <div
                  key={`${hex}-${i}`}
                  className="w-6 h-6 rounded border"
                  style={{ backgroundColor: hex }}
                  title={hex}
                />
              ))}
            </div>
          </div>

          {lookbooks.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Выбрать существующий лукбук</Label>
              <RadioGroup value={selectedLookbookId} onValueChange={setSelectedLookbookId}>
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3 bg-muted/20">
                  {lookbooks.map((lookbook) => (
                    <div key={lookbook.id} className="flex items-center space-x-2">
                      <RadioGroupItem value={lookbook.id} id={`add-colors-${lookbook.id}`} />
                      <Label htmlFor={`add-colors-${lookbook.id}`} className="flex-1 cursor-pointer">
                        {lookbook.name} ({lookbook.person_name})
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
              <Button
                onClick={handleAddToExisting}
                disabled={!selectedLookbookId || isSaving}
                className="w-full"
              >
                {isSaving ? 'Сохранение...' : 'Добавить в выбранный лукбук'}
              </Button>
            </div>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Или создать новый</span>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="new-lookbook-name">Название лукбука</Label>
              <Input
                id="new-lookbook-name"
                placeholder="Например: Моя палитра"
                value={newLookbookName}
                onChange={(e) => setNewLookbookName(e.target.value)}
                disabled={isSaving}
              />
            </div>
            <div>
              <Label htmlFor="new-lookbook-person">Имя персоны</Label>
              <Input
                id="new-lookbook-person"
                placeholder="Например: Анна"
                value={newLookbookPersonName}
                onChange={(e) => setNewLookbookPersonName(e.target.value)}
                disabled={isSaving}
              />
            </div>
            <Button
              onClick={handleCreateNew}
              disabled={!newLookbookName || !newLookbookPersonName || isSaving}
              className="w-full"
            >
              {isSaving ? 'Создание...' : 'Создать новый лукбук'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
