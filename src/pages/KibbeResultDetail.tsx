import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import { KIBBE_TYPES } from '@/data/kibbeTest';

const DB_QUERY_API = 'https://functions.poehali.dev/59a0379b-a4b5-4cec-b2d2-884439f64df9';

interface KibbeRecord {
  id: string;
  user_id: string;
  user_name: string;
  height: number;
  dominance: string;
  winning_letter: string;
  kibbe_type: string;
  created_at: string;
}

function findTypeKeyByName(name: string): string | null {
  const entry = Object.values(KIBBE_TYPES).find((t) => t.name === name);
  return entry ? entry.key : null;
}

export default function KibbeResultDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [record, setRecord] = useState<KibbeRecord | null>(null);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user || !id) return;
    let cancelled = false;

    const fetchDetail = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('session_token');
        const response = await fetch(DB_QUERY_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'X-Session-Token': token } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({
            table: 'kibbe_test_history',
            action: 'select',
            where: { id, user_id: user.id },
            limit: 1,
          }),
        });
        const result = await response.json();
        if (cancelled) return;
        const data = result.success && Array.isArray(result.data) ? result.data : [];
        if (data.length === 0) {
          setErrorText('Результат не найден');
          return;
        }
        setRecord(data[0]);
      } catch (error) {
        if (!cancelled) setErrorText('Не удалось загрузить результат');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchDetail();
    return () => {
      cancelled = true;
    };
  }, [user, id]);

  if (authLoading || isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
          <Icon name="Loader2" className="animate-spin" size={48} />
        </div>
      </Layout>
    );
  }

  if (errorText || !record) {
    return (
      <Layout>
        <section className="py-20">
          <div className="container max-w-md mx-auto px-4 text-center">
            <Icon name="SearchX" size={48} className="mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">{errorText || 'Результат не найден'}</h2>
            <Button className="mt-4" onClick={() => navigate('/profile/history-kibbe')}>
              К истории тестов
            </Button>
          </div>
        </section>
      </Layout>
    );
  }

  const typeKey = findTypeKeyByName(record.kibbe_type);
  const typeInfo = typeKey ? KIBBE_TYPES[typeKey] : null;

  return (
    <Layout>
      <section className="py-12 md:py-20">
        <div className="container max-w-3xl mx-auto px-4">
          <Button variant="ghost" className="mb-4" onClick={() => navigate('/profile/history-kibbe')}>
            <Icon name="ChevronLeft" size={18} className="mr-1" />
            К истории тестов
          </Button>

          <Card>
            <CardContent className="p-6 md:p-8 space-y-6">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-100">
                  <Icon name="Sparkles" size={32} className="text-purple-600" />
                </div>
                <p className="text-muted-foreground mb-1">
                  {record.user_name}, рост {record.height} см
                </p>
                <h1 className="text-3xl font-bold text-purple-700">{record.kibbe_type}</h1>
                {typeInfo && (
                  <p className="mt-2 text-muted-foreground">
                    Доминанта: {typeInfo.dominance} · Линия: {typeInfo.line}
                  </p>
                )}
              </div>

              {typeInfo ? (
                <>
                  {typeInfo.images && typeInfo.images.length > 0 && (
                    <div
                      className={`grid gap-4 ${
                        typeInfo.images.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
                      }`}
                    >
                      {typeInfo.images.map((img, i) => (
                        <img
                          key={i}
                          src={img}
                          alt={typeInfo.name}
                          className="w-full rounded-xl border"
                        />
                      ))}
                    </div>
                  )}

                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <Icon name="Info" size={20} className="text-purple-600" />
                      Описание типажа
                    </h3>
                    <p className="text-muted-foreground whitespace-pre-line">
                      {typeInfo.detailedDescription || typeInfo.shortDescription}
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <Icon name="Shapes" size={20} className="text-purple-600" />
                      Силуэт
                    </h3>
                    <p className="text-muted-foreground">{typeInfo.silhouette}</p>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Icon name="Tags" size={20} className="text-purple-600" />
                      Ключевые слова
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {typeInfo.keywords.map((kw) => (
                        <span
                          key={kw}
                          className="rounded-full bg-purple-100 px-3 py-1 text-sm text-purple-700"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <Icon name="Star" size={20} className="text-purple-600" />
                      Знаменитости-примеры
                    </h3>
                    <p className="text-muted-foreground">{typeInfo.celebrities.join(', ')}</p>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">Подробное описание этого типажа недоступно.</p>
              )}

              <Button
                className="w-full bg-purple-600 text-white hover:bg-purple-700"
                onClick={() => navigate('/kibbe-test')}
              >
                <Icon name="RotateCcw" size={18} className="mr-2" />
                Пройти тест ещё раз
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </Layout>
  );
}