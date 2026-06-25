import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import Layout from '@/components/Layout';
import ProfileMenu from '@/components/ProfileMenu';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

const DB_QUERY_API =
  'https://functions.poehali.dev/59a0379b-a4b5-4cec-b2d2-884439f64df9';

interface UserModel {
  id: number;
  image_url: string;
  gender?: string;
  age?: string;
  height?: string;
  body_type?: string;
  created_at?: string;
}

const GENDER_LABELS: Record<string, string> = {
  female: 'Женская',
  male: 'Мужская',
};

const BODY_TYPE_LABELS: Record<string, string> = {
  slim: 'Худощавое',
  athletic: 'Спортивное',
  average: 'Среднее',
  curvy: 'С формами',
  plus: 'Плюс-сайз',
};

export default function ProfileModels() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [models, setModels] = useState<UserModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  const fetchModels = async () => {
    const token = localStorage.getItem('session_token');
    if (!token) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch(DB_QUERY_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': token,
        },
        credentials: 'include',
        body: JSON.stringify({
          table: 'user_models',
          action: 'select',
          order_by: 'created_at DESC',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setModels(Array.isArray(data?.data) ? data.data : []);
      }
    } catch (e) {
      console.error('[ProfileModels] fetch error', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchModels();
  }, [user]);

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить эту модель?')) return;
    const token = localStorage.getItem('session_token');
    try {
      const res = await fetch(DB_QUERY_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'X-Session-Token': token } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          table: 'user_models',
          action: 'delete',
          where: { id },
        }),
      });
      if (!res.ok) throw new Error('delete failed');
      setModels((prev) => prev.filter((m) => m.id !== id));
      toast.success('Модель удалена');
    } catch (e) {
      console.error('[ProfileModels] delete error', e);
      toast.error('Ошибка удаления');
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

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <ProfileMenu />

          <div className="flex-1">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">Мои модели</h1>
              <p className="text-muted-foreground">
                Сгенерированные модели для примерки одежды
              </p>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Icon name="Loader2" className="animate-spin" size={40} />
              </div>
            ) : models.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed rounded-lg">
                <Icon
                  name="Users"
                  size={48}
                  className="mx-auto mb-4 text-gray-400"
                />
                <p className="text-muted-foreground mb-4">
                  У вас пока нет сгенерированных моделей
                </p>
                <Button onClick={() => navigate('/virtualfitting')}>
                  <Icon name="Sparkles" className="mr-2" size={16} />
                  Создать модель в примерочной
                </Button>
              </div>
            ) : (
              <div className="grid gap-6 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {models.map((m) => (
                  <div
                    key={m.id}
                    className="group relative rounded-lg overflow-hidden border bg-card"
                  >
                    <div className="aspect-[2/3] bg-muted">
                      <img
                        src={m.image_url}
                        alt="Модель"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-3 text-xs text-muted-foreground space-y-0.5">
                      {m.gender && (
                        <div>{GENDER_LABELS[m.gender] || m.gender}</div>
                      )}
                      <div>
                        {[
                          m.age ? `${m.age} лет` : '',
                          m.height ? `${m.height} см` : '',
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </div>
                      {m.body_type && (
                        <div>
                          {BODY_TYPE_LABELS[m.body_type] || m.body_type}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      title="Удалить модель"
                    >
                      <Icon name="Trash2" size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}