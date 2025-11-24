import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import Layout from '@/components/Layout';

export default function RegistrationSuccess() {
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email || '';

  if (!email) {
    navigate('/register');
    return null;
  }

  return (
    <Layout>
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Icon name="Mail" className="text-green-600" size={32} />
            </div>
            <CardTitle className="text-2xl">Проверьте почту</CardTitle>
            <CardDescription>
              Регистрация почти завершена!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-muted-foreground">
              Мы отправили письмо с подтверждением на адрес:
            </p>
            <p className="text-center font-medium">{email}</p>
            <p className="text-center text-sm text-muted-foreground">
              Перейдите по ссылке в письме, чтобы активировать аккаунт.
              Ссылка действительна 24 часа.
            </p>
            
            <div className="pt-4 space-y-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate('/login')}
              >
                Перейти на страницу входа
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Не получили письмо? Проверьте папку «Спам»
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
