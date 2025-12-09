import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import AdminMenu from '@/components/AdminMenu';

export default function AdminCatalog() {
  const navigate = useNavigate();

  useEffect(() => {
    const adminAuth = sessionStorage.getItem('admin_auth');
    if (!adminAuth) {
      navigate('/admin');
    }
  }, [navigate]);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex flex-col lg:flex-row gap-8">
          <AdminMenu />
          
          <div className="flex-1">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">Каталог</h1>
              <p className="text-muted-foreground">Управление каталогом одежды</p>
            </div>

            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Icon name="Package" size={64} className="text-gray-300 mb-4" />
                <h3 className="text-xl font-semibold mb-2">Раздел в разработке</h3>
                <p className="text-muted-foreground mb-6 text-center max-w-md">
                  Функционал управления каталогом находится в разработке. Пока используйте основную страницу админки.
                </p>
                <Button onClick={() => window.location.href = 'https://docs.google.com/spreadsheets/d/1vQZcNpHnlFqpfYN7zy9DqfF2_lRDnHYQWF0W9BRbIaI/edit?usp=sharing'} target="_blank">
                  <Icon name="ExternalLink" size={16} className="mr-2" />
                  Открыть Google Таблицу
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
