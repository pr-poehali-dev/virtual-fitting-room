import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Icon from '@/components/ui/icon';
import FreegenReferenceUpload from '@/components/freegen/FreegenReferenceUpload';
import FreegenAspectSelector from '@/components/freegen/FreegenAspectSelector';
import FreegenResultPanel from '@/components/freegen/FreegenResultPanel';
import {
  checkReplicateBalance,
  deductReplicateBalance,
  refundReplicateBalance,
} from '@/utils/replicateBalanceUtils';
import { GENERATION_COST } from '@/config/prices';
import { useBalance } from '@/context/BalanceContext';

const FREEGEN_START_API = 'https://functions.poehali.dev/093c98ba-e711-4c78-b328-a7494005df42';
const FREEGEN_STATUS_API = 'https://functions.poehali.dev/f706d708-5f17-4c11-864c-d13bf91cebce';
const FREEGEN_WORKER_API = 'https://functions.poehali.dev/8b34e115-88be-4740-887a-36c388980955';

const MAX_REFERENCES = 8;

export default function FreeGeneration() {
  const { user } = useAuth();
  const { refreshBalance } = useBalance();
  const [prompt, setPrompt] = useState('');
  const [references, setReferences] = useState<string[]>([]);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('');
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const insertRefLabel = (index: number) => {
    const label = `@ref${index + 1}`;
    const textarea = promptRef.current;
    if (!textarea) {
      setPrompt((p) => (p ? `${p} ${label}` : label));
      return;
    }
    const start = textarea.selectionStart ?? prompt.length;
    const end = textarea.selectionEnd ?? prompt.length;
    const before = prompt.slice(0, start);
    const after = prompt.slice(end);
    const needsSpaceBefore = before.length > 0 && !before.endsWith(' ');
    const insert = `${needsSpaceBefore ? ' ' : ''}${label} `;
    const next = before + insert + after;
    setPrompt(next);
    setTimeout(() => {
      textarea.focus();
      const pos = (before + insert).length;
      textarea.setSelectionRange(pos, pos);
    }, 0);
  };

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const pollStatus = (id: string) => {
    let attempts = 0;
    const maxAttempts = 120; // 4 минуты при интервале 2с
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
          // Защита: не показываем fal.ai URL, ждём пока worker сохранит в S3
          const url = String(data.result_url);
          const isFalUrl = url.includes('fal.media') || url.includes('fal.run');
          if (isFalUrl) {
            setStatusText('Сохранение...');
            fetch(`${FREEGEN_WORKER_API}?task_id=${id}`).catch(() => {});
            return;
          }
          stopPolling();
          setResultUrl(url);
          setIsGenerating(false);
          setStatusText('Готово!');
          refreshBalance();
          toast.success('Изображение сгенерировано');
          // Триггерим воркер чтобы он сохранил в историю (если не успел)
          fetch(`${FREEGEN_WORKER_API}?task_id=${id}`).catch(() => {});
        } else if (data.status === 'failed') {
          stopPolling();
          setIsGenerating(false);
          setStatusText('');
          toast.error(data.error_message || 'Ошибка генерации');
          refreshBalance();
        } else if (data.status === 'processing') {
          setStatusText('Генерация...');
          if (attempts % 3 === 0) {
            fetch(`${FREEGEN_WORKER_API}?task_id=${id}`).catch(() => {});
          }
        } else if (data.status === 'pending') {
          setStatusText('В очереди...');
          if (attempts % 3 === 0) {
            fetch(`${FREEGEN_WORKER_API}?task_id=${id}`).catch(() => {});
          }
        }

        if (attempts >= maxAttempts) {
          stopPolling();
          setIsGenerating(false);
          setStatusText('');
          toast.error('Превышено время ожидания');
        }
      } catch (e) {
        console.error('[Freegen] poll error:', e);
      }
    }, 2000);
  };

  const handleGenerate = async () => {
    if (!user) {
      toast.error('Нужно войти в аккаунт');
      return;
    }
    const trimmed = prompt.trim();
    if (!trimmed) {
      toast.error('Введите описание');
      return;
    }

    // Проверка баланса (1 шаг как у nanobananapro без референсов)
    const { canGenerate, steps } = await checkReplicateBalance(user, 1);
    if (!canGenerate) return;

    const ok = await deductReplicateBalance(user, steps);
    if (!ok) return;

    setIsGenerating(true);
    setResultUrl(null);
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
          references,
          aspect_ratio: aspectRatio,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setTaskId(data.task_id);
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
    <Layout>
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold mb-2 flex items-center gap-2">
            <Icon name="Sparkles" size={28} />
            Генерация изображений
          </h1>
          <p className="text-sm text-muted-foreground">
            Опиши что нарисовать. При желании — добавь до {MAX_REFERENCES} референсов и ссылайся на них через <code className="px-1 rounded bg-muted">@ref1</code>, <code className="px-1 rounded bg-muted">@ref2</code>…
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <Label htmlFor="freegen-prompt" className="mb-2 block">Промпт</Label>
                  <Textarea
                    id="freegen-prompt"
                    ref={promptRef}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Например: девушка в стиле @ref1, в позе как на @ref2, на фоне заката"
                    rows={5}
                    disabled={isGenerating}
                  />
                </div>

                <FreegenReferenceUpload
                  references={references}
                  onChange={setReferences}
                  onInsertLabel={insertRefLabel}
                  max={MAX_REFERENCES}
                  disabled={isGenerating}
                />

                <FreegenAspectSelector
                  value={aspectRatio}
                  onChange={setAspectRatio}
                  disabled={isGenerating}
                />

                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || !prompt.trim()}
                  className="w-full"
                  size="lg"
                >
                  {isGenerating ? (
                    <>
                      <Icon name="Loader2" size={18} className="mr-2 animate-spin" />
                      {statusText || 'Генерация...'}
                    </>
                  ) : (
                    <>
                      <Icon name="Wand2" size={18} className="mr-2" />
                      Сгенерировать ({GENERATION_COST}₽)
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div>
            <FreegenResultPanel
              resultUrl={resultUrl}
              isGenerating={isGenerating}
              statusText={statusText}
              aspectRatio={aspectRatio}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}