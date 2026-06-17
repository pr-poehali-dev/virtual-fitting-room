import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { ARCHETYPES, ArchetypeKey } from '@/data/archetypeTest';

interface ArchetypeTopCardProps {
  archetypeKey: ArchetypeKey;
  name: string;
  percent: number;
  // index 0 — главный архетип (подробный текст показан сразу),
  // остальные — текст скрыт под раскрывающимся блоком
  index: number;
}

export default function ArchetypeTopCard({
  archetypeKey,
  name,
  percent,
  index,
}: ArchetypeTopCardProps) {
  const info = ARCHETYPES[archetypeKey];
  const isPrimary = index === 0;
  const [expanded, setExpanded] = useState(false);

  const detailed = info.detailedDescription;
  const showDetailed = isPrimary || expanded;

  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-start gap-3">
        {info.image && (
          <img
            src={info.image}
            alt={name}
            className="h-16 w-16 shrink-0 rounded-lg border object-cover"
          />
        )}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-purple-700">{name}</span>
            <span className="text-sm text-muted-foreground">{percent}%</span>
          </div>
          {/* Короткое описание показываем, когда подробный блок свёрнут */}
          {!showDetailed && (
            <p className="text-sm text-muted-foreground">{info.description}</p>
          )}
        </div>
      </div>

      {showDetailed && (
        <>
          {info.image && (
            <img
              src={info.image}
              alt={name}
              className="mt-3 w-full rounded-xl border object-cover"
            />
          )}
          <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">
            {detailed || info.description}
          </p>
        </>
      )}

      {!isPrimary && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-purple-600 hover:text-purple-700"
        >
          {expanded ? 'Свернуть' : 'Подробнее'}
          <Icon name={expanded ? 'ChevronUp' : 'ChevronDown'} size={16} />
        </button>
      )}
    </div>
  );
}