import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/context/AuthContext';
import { useBalance } from '@/context/BalanceContext';
import { GENERATION_COST } from '@/config/prices';
import {
  checkReplicateBalance,
  deductReplicateBalance,
  refundReplicateBalance,
} from '@/utils/replicateBalanceUtils';

const FREEGEN_START_API = 'https://functions.poehali.dev/093c98ba-e711-4c78-b328-a7494005df42';
const FREEGEN_STATUS_API = 'https://functions.poehali.dev/f706d708-5f17-4c11-864c-d13bf91cebce';
const FREEGEN_WORKER_API = 'https://functions.poehali.dev/8b34e115-88be-4740-887a-36c388980955';
const CONSULT_DETAIL_API = 'https://functions.poehali.dev/90841acf-1a1a-4158-a8b6-8ddd65204126';

export interface ConsultPhoto {
  /** Ссылка на изображение */
  url: string;
  /** Подпись: «Ваше фото», «Референс 1» */
  label: string;
  /** Пояснение модели, зачем это фото в генерации */
  why?: string;
}

interface Props {
  /** Задача консультации — к ней прикрепим готовую картинку */
  taskId: string | null;
  /** Промпт, который составила модель */
  initialPrompt: string;
  /** Загруженные фото с подписями */
  photos: ConsultPhoto[];
}

/**
 * Генерация картинки прямо на странице консультации.
 * Использует общий механизм генерации изображений: очередь, статус, возврат денег.
 */
export default function ConsultImageBlock({ taskId, initialPrompt, photos }: Props) {
  const { user } = useAuth();
  const { refreshBalance } = useBalance();
  const [prompt, setPrompt] = useState(initialPrompt);
  const [selected, setSelected] = useState<string[]>(photos.map((p) => p.url));
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [failNote, setFailNote] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => setPrompt(initialPrompt), [initialPrompt]);
  useEffect(() => setSelected(photos.map((p) => p.url)), [photos]);
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const attachToConsult = async (url: string) => {
    if (!taskId) return;
    try {
      const token = localStorage.getItem('session_token');
      await fetch(CONSULT_DETAIL_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'X-Session-Token': token } : {}),
        },
        body: JSON.stringify({ task_id: taskId, cdn_url: url }),
      });
    } catch {
      // Не критично: картинка уже сохранена в истории генераций.
    }
  };

  const pollStatus = (id: string) => {
    let attempts = 0;
    const maxAttempts = 120;
    pollTimerRef.current = setInterval(async () => {
      attempts += 1;
      try {
        const token = localStorage.getItem('session_token');
        const forceCheck = attempts % 5 === 0 ? '&force_check=true' : '';
        const res = await fetch(`${FREEGEN_STATUS_API}?task_id=${id}${forceCheck}`, {
          headers: token ? { 'X-Session-Token': token } : {},
        });
        if (!res.ok) return;
        const data = await res.json();

        if (data.status === 'completed' && data.result_url) {
          const url = String(data.result_url);
          if (url.includes('fal.media') || url.includes('fal.run')) {
            setStatusText('Сохранение...');
            fetch(`${FREEGEN_WORKER_API}?task_id=${id}`).catch(() => {});
            return;
          }
          stopPolling();
          setResultUrl(url);
          setIsGenerating(false);
          setStatusText('');
          refreshBalance();
          toast.success('Изображение готово');
          fetch(`${FREEGEN_WORKER_API}?task_id=${id}`).catch(() => {});
          attachToConsult(url);
        } else if (data.status === 'failed') {
          stopPolling();
          setIsGenerating(false);
          setStatusText('');
          setFailNote(data.error_message || 'Ошибка генерации');
          toast.error(data.error_message || 'Ошибка генерации', { duration: 12000 });
          refreshBalance();
        } else if (data.status === 'processing') {
          setStatusText('Рисуем изображение...');
          if (attempts % 3 === 0) fetch(`${FREEGEN_WORKER_API}?task_id=${id}`).catch(() => {});
        } else if (data.status === 'pending') {
          setStatusText('В очереди...');
          if (attempts % 3 === 0) fetch(`${FREEGEN_WORKER_API}?task_id=${id}`).catch(() => {});
        }

        if (attempts >= maxAttempts) {
          stopPolling();
          setIsGenerating(false);
          setStatusText('');
          toast.error('Превышено время ожидания');
        }
      } catch (e) {
        console.error('[Consult] poll error:', e);
      }
    }, 2000);
  };

  const toggle = (url: string) => {
    setSelected((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url],
    );
  };

  const handleGenerate = async () => {
    if (!user) {
      toast.error('Нужно войти в аккаунт');
      return;
    }
    const trimmed = prompt.trim();
    if (!trimmed) {
      toast.error('Промпт пустой');
      return;
    }

    const { canGenerate, steps } = await checkReplicateBalance(user, 1);
    if (!canGenerate) return;
    const ok = await deductReplicateBalance(user, steps);
    if (!ok) return;

    setIsGenerating(true);
    setResultUrl(null);
    setFailNote(null);
    setStatusText('Отправка...');

    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch(FREEGEN_START_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'X-Session-Token': token } : {}),
        },
        body: JSON.stringify({
          prompt: trimmed,
          references: selected,
          aspect_ratio: '1:1',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      refreshBalance();
      setStatusText('В очереди...');
      pollStatus(data.task_id);
    } catch (e) {
      setIsGenerating(false);
      setStatusText('');
      await refundReplicateBalance(user, 1);
      refreshBalance();
      toast.error(e instanceof Error ? e.message : 'Ошибка запуска');
    }
  };

  return (
    <Card className="border-purple-200">
      <CardContent className="p-5 space-y-4">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Icon name="Image" size={18} className="text-purple-600" />
            Сгенерировать картинку
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Стоимость — {GENERATION_COST} ₽. Промпт можно отредактировать перед запуском.
          </p>
        </div>

        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={5}
          disabled={isGenerating}
          className="text-sm"
        />

        {photos.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-1">Какие фото отправить в генерацию</p>
            <p className="text-xs text-muted-foreground mb-2">
              Отметьте только те фото, которые действительно нужны на картинке. Лишние
              снимки сбивают модель и ухудшают результат — если вещь достаточно описать
              словами, снимите галочку.
            </p>
            <div className="space-y-2">
              {photos.map((photo) => (
                <label
                  key={photo.url}
                  className="flex items-start gap-3 rounded-lg border p-2 cursor-pointer hover:bg-muted/50"
                >
                  <Checkbox
                    checked={selected.includes(photo.url)}
                    onCheckedChange={() => toggle(photo.url)}
                    disabled={isGenerating}
                    className="mt-3"
                  />
                  <img
                    src={photo.url}
                    alt={photo.label}
                    className="w-14 h-14 rounded object-cover border shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{photo.label}</span>
                    {photo.why && (
                      <span className="block text-xs text-muted-foreground">
                        {photo.why}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <Button onClick={handleGenerate} disabled={isGenerating} className="w-full">
          {isGenerating ? (
            <>
              <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
              {statusText || 'Генерация...'}
            </>
          ) : (
            <>
              <Icon name="Sparkles" size={16} className="mr-2" />
              Сгенерировать картинку — {GENERATION_COST} ₽
            </>
          )}
        </Button>

        {failNote && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-gray-700">
            {failNote}
          </div>
        )}

        {resultUrl && (
          <div className="space-y-2">
            <img
              src={resultUrl}
              alt="Результат генерации"
              className="w-full rounded-lg border"
            />
            <Button asChild variant="outline" className="w-full">
              <a href={resultUrl} target="_blank" rel="noreferrer" download>
                <Icon name="Download" size={16} className="mr-2" />
                Скачать
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
