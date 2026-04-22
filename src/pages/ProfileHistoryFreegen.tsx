import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import Layout from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import ProfileMenu from '@/components/ProfileMenu';
import { toast } from 'sonner';

const DB_QUERY_API = 'https://functions.poehali.dev/59a0379b-a4b5-4cec-b2d2-884439f64df9';

interface FreegenItem {
  id: string;
  prompt: string;
  result_image: string;
  aspect_ratio: string | null;
  cost: number | null;
  created_at: string;
  removed_at?: string | null;
}

export default function ProfileHistoryFreegen() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<FreegenItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [user, authLoading, navigate]);

  const load = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch(DB_QUERY_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'X-Session-Token': token } : {}),
        },
        body: JSON.stringify({
          table: 'freegen_history',
          action: 'select',
          where: { user_id: user.id },
          order_by: 'created_at DESC',
          limit: 200,
          columns: ['id', 'prompt', 'result_image', 'aspect_ratio', 'cost', 'created_at', 'removed_at'],
        }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.rows)) {
        setItems(data.rows.filter((r: FreegenItem) => !r.removed_at));
      }
    } catch (e) {
      console.error('[FreegenHistory]', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleDelete = async (id: string) => {
    if (!user) return;
    if (!confirm('Удалить это изображение из истории?')) return;
    try {
      const token = localStorage.getItem('session_token');
      const res = await fetch(DB_QUERY_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'X-Session-Token': token } : {}),
        },
        body: JSON.stringify({
          table: 'freegen_history',
          action: 'update',
          where: { id, user_id: user.id },
          data: { removed_at: new Date().toISOString() },
        }),
      });
      if (res.ok) {
        setItems((prev) => prev.filter((x) => x.id !== id));
        toast.success('Удалено');
      } else {
        toast.error('Ошибка удаления');
      }
    } catch {
      toast.error('Ошибка удаления');
    }
  };

  const handleDownload = async (url: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = `freegen-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(href);
    } catch {
      window.open(url, '_blank');
    }
  };

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
          <Icon name="Loader2" className="animate-spin" size={48} />
        </div>
      </Layout>
    );
  }

  if (!user) return null;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <ProfileMenu />

          <div className="flex-1">
            <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-3xl font-bold mb-2">История генераций</h1>
                <p className="text-muted-foreground">Ваши свободные генерации NanoBanana 2</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={load}
                disabled={isLoading}
                className="gap-2"
              >
                <Icon
                  name={isLoading ? 'Loader2' : 'RefreshCw'}
                  size={14}
                  className={isLoading ? 'animate-spin' : ''}
                />
                Обновить
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Icon name="Loader2" className="animate-spin" size={40} />
              </div>
            ) : items.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  <Icon name="Sparkles" size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Пока нет генераций</p>
                  <Button className="mt-4" onClick={() => navigate('/freegeneration')}>
                    Создать первую
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {items.map((it) => (
                  <Card key={it.id} className="overflow-hidden group">
                    <div
                      className="aspect-square bg-muted cursor-pointer"
                      onClick={() => setSelected(it.result_image)}
                    >
                      <img
                        src={it.result_image}
                        alt={it.prompt.slice(0, 40)}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                        {it.prompt}
                      </p>
                      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                        <span>{it.aspect_ratio || '1:1'}</span>
                        <span>{new Date(it.created_at).toLocaleDateString('ru-RU')}</span>
                      </div>
                      <div className="flex gap-1 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-7 text-xs"
                          onClick={() => handleDownload(it.result_image)}
                        >
                          <Icon name="Download" size={12} className="mr-1" />
                          Скачать
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 w-7 p-0"
                          onClick={() => handleDelete(it.id)}
                          aria-label="Удалить"
                        >
                          <Icon name="Trash2" size={12} />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {selected && (
              <div
                className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
                onClick={() => setSelected(null)}
              >
                <img
                  src={selected}
                  alt="Просмотр"
                  className="max-w-full max-h-full object-contain"
                />
                <button
                  onClick={() => setSelected(null)}
                  className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center"
                  aria-label="Закрыть"
                >
                  <Icon name="X" size={20} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}