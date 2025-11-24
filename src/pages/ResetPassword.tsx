import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import Layout from '@/components/Layout';

const PASSWORD_RESET_API = 'https://functions.poehali.dev/94d17619-aeab-4b07-b099-fafb742f304c';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isValidToken, setIsValidToken] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [isPasswordReset, setIsPasswordReset] = useState(false);

  useEffect(() => {
    if (!token) {
      setTokenError('Токен не найден');
      setIsValidating(false);
      return;
    }

    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      const response = await fetch(`${PASSWORD_RESET_API}?token=${token}`);
      const data = await response.json();

      if (data.valid) {
        setIsValidToken(true);
      } else {
        setTokenError(data.error || 'Недействительный токен');
      }
    } catch (error) {
      setTokenError('Ошибка проверки токена');
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
      toast.error('Заполните все поля');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Пароль должен быть не менее 6 символов');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Пароли не совпадают');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(PASSWORD_RESET_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'reset_password',
          token,
          new_password: newPassword
        })
      });

      const data = await response.json();

      if (response.ok) {
        setIsPasswordReset(true);
        toast.success('Пароль успешно изменён!');
        setTimeout(() => navigate('/login'), 3000);
      } else {
        toast.error(data.error || 'Ошибка при смене пароля');
      }
    } catch (error) {
      toast.error('Ошибка соединения с сервером');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Новый пароль</CardTitle>
            <CardDescription className="text-center">
              {isPasswordReset
                ? 'Пароль успешно изменён'
                : 'Введите новый пароль для вашего аккаунта'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isValidating ? (
              <div className="flex justify-center py-8">
                <Icon name="Loader2" className="animate-spin text-primary" size={48} />
              </div>
            ) : !isValidToken ? (
              <div className="space-y-4">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                    <Icon name="AlertCircle" className="text-red-600" size={32} />
                  </div>
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  {tokenError}
                </p>
                <Button onClick={() => navigate('/forgot-password')} className="w-full">
                  Запросить новую ссылку
                </Button>
              </div>
            ) : isPasswordReset ? (
              <div className="space-y-4">
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <Icon name="CheckCircle" className="text-green-600" size={32} />
                  </div>
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  Ваш пароль был успешно изменён. Сейчас вы будете перенаправлены на страницу входа...
                </p>
                <Button onClick={() => navigate('/login')} className="w-full">
                  Перейти к входу
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="newPassword" className="text-sm font-medium">
                    Новый пароль
                  </label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="Минимум 6 символов"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="text-sm font-medium">
                    Подтвердите пароль
                  </label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Повторите пароль"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Icon name="Loader2" className="mr-2 animate-spin" size={18} />
                      Сохранение...
                    </>
                  ) : (
                    <>
                      <Icon name="Lock" className="mr-2" size={18} />
                      Изменить пароль
                    </>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
