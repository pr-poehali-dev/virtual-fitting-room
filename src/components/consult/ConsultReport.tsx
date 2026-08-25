import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

export interface ConsultSection {
  title?: string;
  text?: string;
}

export interface ConsultItem {
  name?: string;
  description?: string;
  why?: string;
}

export interface ConsultPhotoUsage {
  label?: string;
  /** Что берём с фото: person | item | both */
  role?: string;
  why?: string;
}

export interface ConsultResult {
  title?: string;
  summary?: string;
  sections?: ConsultSection[];
  items?: ConsultItem[];
  avoid?: string[];
  tips?: string[];
  image_prompt?: string;
  photo_usage?: ConsultPhotoUsage[];
  source_image?: string | null;
  reference_images?: string[];
  /** Все картинки, сгенерированные по этой консультации */
  generated_images?: string[];
}

interface Props {
  data: ConsultResult;
  /** Вопрос пользователя — показываем над ответом */
  question?: string;
  onReset?: () => void;
}

/** Текстовый отчёт консультации: вывод, разделы, конкретные пункты, советы, промпт. */
export default function ConsultReport({ data, question, onReset }: Props) {
  const sections = Array.isArray(data.sections) ? data.sections : [];
  const items = Array.isArray(data.items) ? data.items : [];
  const avoid = Array.isArray(data.avoid) ? data.avoid : [];
  const tips = Array.isArray(data.tips) ? data.tips : [];
  const prompt = (data.image_prompt || '').trim();

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success('Промпт скопирован');
    } catch {
      toast.error('Не удалось скопировать');
    }
  };

  return (
    <div className="space-y-4">
      {question && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              Ваш вопрос
            </p>
            <p className="text-sm whitespace-pre-wrap">{question}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-5 space-y-4">
          {data.title && (
            <h2 className="text-xl font-bold flex items-start gap-2">
              <Icon name="Sparkles" size={20} className="mt-1 shrink-0 text-purple-600" />
              {data.title}
            </h2>
          )}
          {data.summary && <p className="text-sm leading-relaxed">{data.summary}</p>}

          {sections.map((s, i) => (
            <div key={i} className="pt-2 border-t first:border-t-0">
              {s.title && <h3 className="font-semibold mb-1">{s.title}</h3>}
              {s.text && (
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-700">
                  {s.text}
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {items.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <h3 className="font-semibold mb-3">Конкретные рекомендации</h3>
            <div className="space-y-3">
              {items.map((item, i) => (
                <div key={i} className="rounded-lg border p-3">
                  {item.name && <p className="font-medium">{item.name}</p>}
                  {item.description && (
                    <p className="text-sm text-gray-700 mt-1">{item.description}</p>
                  )}
                  {item.why && (
                    <p className="text-sm text-muted-foreground mt-1">{item.why}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(avoid.length > 0 || tips.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4">
          {avoid.length > 0 && (
            <Card>
              <CardContent className="p-5">
                <h3 className="font-semibold mb-2">Чего избегать</h3>
                <ul className="space-y-1.5">
                  {avoid.map((a, i) => (
                    <li key={i} className="text-sm flex gap-2">
                      <Icon name="X" size={14} className="mt-1 shrink-0 text-red-500" />
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {tips.length > 0 && (
            <Card>
              <CardContent className="p-5">
                <h3 className="font-semibold mb-2">Советы</h3>
                <ul className="space-y-1.5">
                  {tips.map((t, i) => (
                    <li key={i} className="text-sm flex gap-2">
                      <Icon
                        name="Check"
                        size={14}
                        className="mt-1 shrink-0 text-green-600"
                      />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {prompt && (
        <Card className="border-purple-200 bg-purple-50/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Icon name="Wand2" size={18} className="text-purple-600" />
                Промпт для генерации
              </h3>
              <Button type="button" variant="outline" size="sm" onClick={copyPrompt}>
                <Icon name="Copy" size={14} className="mr-1.5" />
                Копировать
              </Button>
            </div>
            <p className="text-sm whitespace-pre-wrap bg-white rounded-lg border p-3">
              {prompt}
            </p>
          </CardContent>
        </Card>
      )}

      {onReset && (
        <Button variant="outline" onClick={onReset} className="w-full">
          <Icon name="RotateCcw" size={16} className="mr-2" />
          Задать новый вопрос
        </Button>
      )}
    </div>
  );
}