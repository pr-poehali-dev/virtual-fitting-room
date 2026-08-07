import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

interface ServiceTypeFilterProps {
  /** Названия типов услуг: { glasses: 'Подбор очков', ... } */
  labels: Record<string, string>;
  /** Количество записей каждого типа */
  counts: Record<string, number>;
  /** Выбранные (ещё не применённые) типы */
  draft: string[];
  onDraftChange: (next: string[]) => void;
  /** Применённые типы — по ним сейчас показан список */
  applied: string[];
  onApply: () => void;
  isLoading: boolean;
}

/**
 * Фильтр истории по типу услуги.
 * Выбор накапливается, запрос уходит только по кнопке «Применить».
 */
export default function ServiceTypeFilter({
  labels,
  counts,
  draft,
  onDraftChange,
  applied,
  onApply,
  isLoading,
}: ServiceTypeFilterProps) {
  const availableTypes = Object.keys(labels).filter((key) => (counts[key] || 0) > 0);

  if (availableTypes.length === 0) return null;

  const isAllSelected = draft.length === 0;
  const hasChanges =
    draft.length !== applied.length || draft.some((t) => !applied.includes(t));

  const toggleType = (type: string) => {
    onDraftChange(
      draft.includes(type) ? draft.filter((t) => t !== type) : [...draft, type]
    );
  };

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={isAllSelected ? 'default' : 'outline'}
            onClick={() => onDraftChange([])}
            className="h-8"
          >
            Все
          </Button>

          {availableTypes.map((type) => {
            const isActive = draft.includes(type);
            return (
              <Button
                key={type}
                size="sm"
                variant={isActive ? 'default' : 'outline'}
                onClick={() => toggleType(type)}
                className="h-8"
              >
                {isActive && <Icon name="Check" size={14} className="mr-1" />}
                {labels[type]}
                <span
                  className={`ml-1.5 ${isActive ? 'opacity-80' : 'text-muted-foreground'}`}
                >
                  {counts[type]}
                </span>
              </Button>
            );
          })}
        </div>

        {hasChanges && (
          <div className="flex items-center gap-3 mt-3 pt-3 border-t">
            <Button size="sm" onClick={onApply} disabled={isLoading} className="h-8">
              {isLoading ? (
                <>
                  <Icon name="Loader2" size={14} className="mr-1.5 animate-spin" />
                  Применяем...
                </>
              ) : (
                'Применить'
              )}
            </Button>
            <span className="text-sm text-muted-foreground">
              {isAllSelected
                ? 'Показать все отчёты'
                : `Выбрано типов: ${draft.length}`}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
