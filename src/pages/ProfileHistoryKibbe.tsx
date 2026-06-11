import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import ProfileMenu from '@/components/ProfileMenu';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const DB_QUERY_API = 'https://functions.poehali.dev/59a0379b-a4b5-4cec-b2d2-884439f64df9';

export default function ProfileHistoryKibbe() {
  const { user, isLoading: authLoading } = useAuth();
  const {
    kibbeHistory,
    isLoading: dataLoading,
    hasMoreKibbe,
    isLoadingMoreKibbe,
    refetchKibbeHistory,
    loadMoreKibbe,
  } = useData();
  const navigate = useNavigate();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    if (!confirm('Удалить этот результат теста Кибби?')) {
      return;
    }

    setDeletingId(id);

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
          action: 'delete',
          where: { id },
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Результат удалён');
        await refetchKibbeHistory();
      } else {
        toast.error('Ошибка удаления');
      }
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Ошибка удаления');
    } finally {
      setDeletingId(null);
    }
  };

  if (authLoading || dataLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
          <Icon name="Loader2" className="animate-spin" size={48} />
        </div>
      </Layout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <ProfileMenu />

          <div className="flex-1">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">История тестов Кибби</h1>
              <p className="text-muted-foreground">Все ваши результаты теста «Типаж по Кибби»</p>
            </div>

            {kibbeHistory.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Icon name="Ruler" className="mx-auto mb-4 text-muted-foreground" size={64} />
                  <h3 className="text-xl font-medium mb-2">История пуста</h3>
                  <p className="text-muted-foreground mb-6">Вы ещё не проходили тест Кибби</p>
                  <button
                    onClick={() => navigate('/kibbe-test')}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <Icon name="Ruler" size={20} />
                    Пройти тест
                  </button>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {kibbeHistory.map((item) => (
                    <Card
                      key={item.id}
                      className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                      onClick={() => navigate(`/kibbe-result/${item.id}`)}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-100">
                            <Icon name="Sparkles" size={24} className="text-purple-700" />
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => handleDelete(item.id, e)}
                            disabled={deletingId === item.id}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            {deletingId === item.id ? (
                              <Icon name="Loader2" className="animate-spin" size={16} />
                            ) : (
                              <Icon name="Trash2" size={16} />
                            )}
                          </Button>
                        </div>
                        <h3 className="font-semibold text-lg text-purple-700">{item.kibbe_type}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {item.user_name} · рост {item.height} см
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{item.dominance}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(item.created_at).toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {hasMoreKibbe && (
                  <div className="flex justify-center mt-6">
                    <Button variant="outline" onClick={loadMoreKibbe} disabled={isLoadingMoreKibbe}>
                      {isLoadingMoreKibbe ? (
                        <>
                          <Icon name="Loader2" className="mr-2 animate-spin" size={16} />
                          Загрузка...
                        </>
                      ) : (
                        <>
                          <Icon name="ChevronDown" className="mr-2" size={16} />
                          Загрузить ещё
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
