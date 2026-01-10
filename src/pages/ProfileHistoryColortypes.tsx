import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import ProfileMenu from '@/components/ProfileMenu';
import { Card, CardContent } from '@/components/ui/card';

const colorTypeNames: Record<string, string> = {
  'SOFT WINTER': 'Мягкая Зима',
  'BRIGHT WINTER': 'Яркая Зима',
  'VIVID WINTER': 'Тёмная Зима',
  'SOFT SUMMER': 'Светлое Лето',
  'DUSTY SUMMER': 'Мягкое (Пыльное) Лето',
  'VIVID SUMMER': 'Яркое Лето',
  'GENTLE AUTUMN': 'Нежная Осень',
  'FIERY AUTUMN': 'Огненная Осень',
  'VIVID AUTUMN': 'Тёмная Осень',
  'GENTLE SPRING': 'Нежная Весна',
  'BRIGHT SPRING': 'Тёплая Весна',
  'VIBRANT SPRING': 'Яркая Весна'
};

interface ColorTypeHistory {
  id: string;
  person_image?: string;
  color_type: string;
  result_text: string;
  created_at: string;
  status: string;
}

export default function ProfileHistoryColortypes() {
  const { user, isLoading: authLoading } = useAuth();
  const { colorTypeHistory, isLoading: dataLoading } = useData();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

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
              <h1 className="text-3xl font-bold mb-2">История цветотипов</h1>
              <p className="text-muted-foreground">Все ваши анализы цветотипа внешности</p>
            </div>

            {colorTypeHistory.length === 0 ? (
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
                {colorTypeHistory.map((item) => (
                  <Card key={item.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="mb-4">
                        <h3 className="font-semibold text-xl mb-2">
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
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
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