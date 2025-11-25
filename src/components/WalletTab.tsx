import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useSearchParams } from 'react-router-dom';

const USER_BALANCE_API = 'https://functions.poehali.dev/68409278-10ab-4733-b48d-b1b4360620a1';
const PAYMENT_API = 'https://functions.poehali.dev/90e72041-1a9e-4a24-9d4b-dc3347bdbe77';

interface BalanceInfo {
  balance: number;
  free_tries_remaining: number;
  paid_tries_available: number;
  unlimited_access: boolean;
  can_generate: boolean;
}

export default function WalletTab() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [balanceInfo, setBalanceInfo] = useState<BalanceInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);

  useEffect(() => {
    if (user) {
      fetchBalance();
    }
    
    const payment = searchParams.get('payment');
    if (payment === 'success') {
      toast.success('Платеж успешно обработан!');
      setTimeout(() => fetchBalance(), 1000);
    } else if (payment === 'failed') {
      toast.error('Ошибка оплаты');
    }
  }, [user, searchParams]);

  const fetchBalance = async () => {
    if (!user) return;

    try {
      const response = await fetch(USER_BALANCE_API, {
        headers: {
          'X-User-Id': user.id
        }
      });

      if (response.ok) {
        const data = await response.json();
        setBalanceInfo(data);
      } else {
        toast.error('Ошибка загрузки баланса');
      }
    } catch (error) {
      toast.error('Ошибка соединения');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTopUp = async (amount: number) => {
    if (!user) return;

    setIsCreatingPayment(true);

    try {
      const response = await fetch(PAYMENT_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: user.id,
          amount
        })
      });

      const data = await response.json();

      if (response.ok && data.payment_url) {
        window.location.href = data.payment_url;
      } else {
        toast.error(data.error || 'Ошибка создания платежа');
      }
    } catch (error) {
      toast.error('Ошибка соединения');
    } finally {
      setIsCreatingPayment(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Icon name="Loader2" className="animate-spin" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="Wallet" size={24} />
              Баланс
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Сумма на счету</p>
                <p className="text-4xl font-light">{balanceInfo?.balance.toFixed(2)} ₽</p>
              </div>
              
              {balanceInfo?.unlimited_access ? (
                <div className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-3 rounded-lg">
                  <Icon name="Infinity" size={20} />
                  <span className="font-medium">Безлимитный доступ</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Бесплатных примерок:</span>
                    <span className="font-medium">{balanceInfo?.free_tries_remaining} / 3</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Доступно примерок:</span>
                    <span className="font-medium">{balanceInfo?.paid_tries_available}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Стоимость одной примерки: 25 ₽
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="CreditCard" size={24} />
              Пополнение
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Выберите сумму для пополнения баланса
            </p>
            <div className="space-y-3">
              <Button
                className="w-full justify-between"
                variant="outline"
                size="lg"
                onClick={() => handleTopUp(100)}
                disabled={isCreatingPayment}
              >
                <span>100 ₽</span>
                <span className="text-sm text-muted-foreground">4 примерки</span>
              </Button>
              <Button
                className="w-full justify-between"
                variant="outline"
                size="lg"
                onClick={() => handleTopUp(300)}
                disabled={isCreatingPayment}
              >
                <span>300 ₽</span>
                <span className="text-sm text-muted-foreground">12 примерок</span>
              </Button>
              <Button
                className="w-full justify-between"
                variant="outline"
                size="lg"
                onClick={() => handleTopUp(1000)}
                disabled={isCreatingPayment}
              >
                <span>1000 ₽</span>
                <span className="text-sm text-muted-foreground">40 примерок</span>
              </Button>
            </div>
            {isCreatingPayment && (
              <div className="flex items-center justify-center mt-4">
                <Icon name="Loader2" className="animate-spin mr-2" size={16} />
                <span className="text-sm">Переход к оплате...</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-4">
              Оплата через Сбербанк. Безопасная обработка платежей.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}