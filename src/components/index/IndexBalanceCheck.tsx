import { toast } from 'sonner';

interface User {
  id: string;
  email: string;
  name: string;
}

export const checkAndDeductBalance = async (user: User | null): Promise<boolean> => {
  if (!user) {
    toast.error('Для генерации изображений необходимо войти в аккаунт');
    return false;
  }

  try {
    const balanceCheck = await fetch('https://functions.poehali.dev/68409278-10ab-4733-b48d-b1b4360620a1', {
      headers: {
        'X-User-Id': user.id
      }
    });

    if (balanceCheck.ok) {
      const balanceData = await balanceCheck.json();
      
      if (!balanceData.can_generate) {
        toast.error('Недостаточно средств. Пополните баланс в личном кабинете.');
        return false;
      }
    }

    const deductResponse = await fetch('https://functions.poehali.dev/68409278-10ab-4733-b48d-b1b4360620a1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': user.id
      },
      body: JSON.stringify({
        action: 'deduct'
      })
    });

    if (!deductResponse.ok) {
      const errorData = await deductResponse.json();
      toast.error(errorData.error || 'Ошибка списания средств');
      return false;
    }

    const deductData = await deductResponse.json();
    
    if (deductData.free_try) {
      toast.info(`Бесплатная примерка! Осталось: ${deductData.remaining_free}`);
    } else if (deductData.paid_try) {
      toast.info(`Списано 25₽. Баланс: ${deductData.new_balance.toFixed(2)}₽`);
    } else if (deductData.unlimited) {
      toast.info('Безлимитный доступ активен');
    }

    return true;
  } catch (error) {
    toast.error('Ошибка проверки баланса');
    return false;
  }
};
