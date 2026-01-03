import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';
import ProfileMenu from '@/components/ProfileMenu';
import { Card, CardContent } from '@/components/ui/card';

const DB_QUERY_API = 'https://functions.poehali.dev/59a0379b-a4b5-4cec-b2d2-884439f64df9';

const colorTypeNames: Record<string, string> = {
  'SOFT WINTER': 'Мягкая Зима',
  'BRIGHT WINTER': 'Яркая Зима',
  'VIVID WINTER': 'Насыщенная Зима',
  'SOFT SUMMER': 'Мягкое Лето',
  'DUSTY SUMMER': 'Пыльное Лето',
  'VIVID SUMMER': 'Насыщенное Лето',
  'GENTLE AUTUMN': 'Нежная Осень',
  'FIERY AUTUMN': 'Огненная Осень',
  'VIVID AUTUMN': 'Насыщенная Осень',
  'GENTLE SPRING': 'Нежная Весна',
  'BRIGHT SPRING': 'Яркая Весна',
  'VIBRANT SPRING': 'Сочная Весна'
};

interface ColorTypeHistory {
  id: string;
  person_image: string;
  color_type: string;
  result_text: string;
  created_at: string;
  status: string;
}

export default function ProfileHistoryColortypes() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [historyItems, setHistoryItems] = useState<ColorTypeHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasFetched, setHasFetched] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && !hasFetched) {
      fetchHistory();
    }
  }, [user, hasFetched]);

  const fetchHistory = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const response = await fetch(DB_QUERY_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': user.id
        },
        body: JSON.stringify({
          table: 'color_type_history',
          action: 'select',
          where: { user_id: user.id, status: 'completed' },
          order_by: 'created_at DESC',
          limit: 100
        })
      });
      const result = await response.json();
      const data = result.success && Array.isArray(result.data) ? result.data : [];
      setHistoryItems(data);
      setHasFetched(true);
    } catch (error) {
      console.error('Error fetching color type history:', error);
      setHistoryItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || isLoading) {
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
              <h1 className="text-3xl font-bold mb-2">История цветотипов</h1>
              <p className="text-muted-foreground">Все ваши анализы цветотипа внешности</p>
            </div>

            {historyItems.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Icon name="Palette" className="mx-auto mb-4 text-muted-foreground" size={64} />
                  <h3 className="text-xl font-medium mb-2">История пуста</h3>
                  <p className="text-muted-foreground mb-6">
                    У вас пока нет анализов цветотипа
                  </p>
                  <button
                    onClick={() => navigate('/colortype')}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <Icon name="Palette" size={20} />
                    Определить цветотип
                  </button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {historyItems.map((item) => (
                  <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="aspect-[3/4] relative overflow-hidden bg-muted">
                      <img
                        src={item.person_image}
                        alt="Portrait"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <CardContent className="p-4">
                      <div className="mb-2">
                        <h3 className="font-semibold text-lg">
                          {item.color_type ? (colorTypeNames[item.color_type] || item.color_type) : 'Цветотип'}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      {item.result_text && (
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {item.result_text}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
