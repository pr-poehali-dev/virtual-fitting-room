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
const IMAGE_PROXY_API = 'https://functions.poehali.dev/7f105c4b-f9e7-4df3-9f64-3d35895b8e90';

/** Что берём с фото при генерации картинки */
export type PhotoRole = 'person' | 'item' | 'both';

export interface ConsultPhoto {
  /** Ссылка на изображение */
  url: string;
  /** Подпись: «Ваше фото», «Референс 1» */
  label: string;
  /** Пояснение модели, зачем это фото в генерации */
  why?: string;
  /** Роль, которую предложила модель */
  role?: PhotoRole;
}

const ROLE_OPTIONS: { value: PhotoRole; label: string }[] = [
  { value: 'person', label: 'Внешность' },
  { value: 'item', label: 'Вещь' },
  { value: 'both', label: 'И внешность, и вещь' },
];

/**
 * Приписка к промпту: рисующая модель не понимает, зачем ей приложили фото,
 * пока это не сказано словами. Нумерацию считаем по отмеченным фото,
 * поэтому текст пересобирается при каждом изменении галочек.
 */
function buildPhotoInstruction(
  photos: ConsultPhoto[],
  selected: string[],
  roles: Record<string, PhotoRole>,
): string {
  const used = photos.filter((p) => selected.includes(p.url));
  if (used.length === 0) return '';

  const lines = used.map((photo, i) => {
    const position = used.length === 1 ? 'На приложенном фото' : `На фото ${i + 1}`;
    const role = roles[photo.url] || photo.role || 'item';
    if (role === 'person') {
      return `${position} — человек: точно сохрани его лицо, черты, телосложение, цвет и длину волос. Одежду с этого фото не переноси.`;
    }
    if (role === 'both') {
      return `${position} — человек в своей одежде: точно сохрани его лицо, черты, телосложение, цвет и длину волос, а надетую на нём вещь повтори точь-в-точь — крой, цвет, ткань, все детали.`;
    }
    return `${position} — вещь: повтори её точь-в-точь, включая крой, цвет, ткань, фурнитуру и все детали. Не заменяй её похожей.`;
  });

  return `\n\nВАЖНО ПРО ПРИЛОЖЕННЫЕ ФОТО:\n${lines.join('\n')}`;
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
  const [roles, setRoles] = useState<Record<string, PhotoRole>>(() =>
    Object.fromEntries(photos.map((p) => [p.url, p.role || 'item'])),
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [failNote, setFailNote] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => setPrompt(initialPrompt), [initialPrompt]);

  // Список фото пересобирается при каждой перерисовке страницы (например, после
  // обновления баланса). Сбрасываем выбор только когда набор фото реально другой,
  // иначе настройки пользователя терялись бы у него на глазах.
  const photosKey = photos.map((p) => p.url).join('|');
  useEffect(() => {
    setSelected(photos.map((p) => p.url));
    setRoles(Object.fromEntries(photos.map((p) => [p.url, p.role || 'item'])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photosKey]);
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

  const handleDownload = async () => {
    if (!resultUrl) return;
    const filename = `consult-${Date.now()}.png`;
    try {
      let blob: Blob;
      const needsProxy = !resultUrl.includes('cdn.poehali.dev');

      if (needsProxy) {
        const sessionToken = localStorage.getItem('session_token');
        const proxyResponse = await fetch(IMAGE_PROXY_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(sessionToken ? { 'X-Session-Token': sessionToken } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({ image_url: resultUrl }),
        });
        if (!proxyResponse.ok) throw new Error('Не удалось получить файл');
        const proxyData = await proxyResponse.json();
        const response = await fetch(proxyData.data_url);
        blob = await response.blob();
      } else {
        const response = await fetch(resultUrl);
        blob = await response.blob();
      }

      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
      toast.success('Фото скачано');
    } catch (e) {
      console.error('[Consult] download error:', e);
      toast.error('Не удалось скачать изображение');
    }
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
          prompt: trimmed + buildPhotoInstruction(photos, selected, roles),
          references: selected,
          aspect_ratio: '1:1',
          consult_task_id: taskId,
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
              {photos.map((photo) => {
                const isOn = selected.includes(photo.url);
                const role = roles[photo.url] || 'item';
                return (
                  <div key={photo.url} className="rounded-lg border p-2">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={isOn}
                        onCheckedChange={() => toggle(photo.url)}
                        disabled={isGenerating}
                        className="mt-3"
                      />
                      <img
                        src={photo.url}
                        alt={photo.label}
                        className="w-14 h-14 rounded object-cover border shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{photo.label}</p>
                        {photo.why && (
                          <p className="text-xs text-muted-foreground">{photo.why}</p>
                        )}
                      </div>
                    </div>

                    {isOn && (
                      <div className="mt-2 pl-8">
                        <p className="text-xs text-muted-foreground mb-1">
                          Что взять с этого фото
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {ROLE_OPTIONS.map((opt) => (
                            <Button
                              key={opt.value}
                              type="button"
                              size="sm"
                              variant={role === opt.value ? 'default' : 'outline'}
                              disabled={isGenerating}
                              className="h-7 text-xs"
                              onClick={() =>
                                setRoles((prev) => ({
                                  ...prev,
                                  [photo.url]: opt.value,
                                }))
                              }
                            >
                              {opt.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Нейросеть уже выбрала, что брать с каждого фото — поправьте, если она
              ошиблась. Эти указания добавляются к промпту автоматически.
            </p>
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
            <Button variant="outline" className="w-full" onClick={handleDownload}>
              <Icon name="Download" size={16} className="mr-2" />
              Скачать
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}