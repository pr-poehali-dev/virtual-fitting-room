import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import Icon from '@/components/ui/icon';
import {
  loadVkSdk,
  initVkConfig,
  type VkExchangeData,
  type VkLoginPayload,
} from '@/lib/vkid';

interface VkAuthButtonProps {
  className?: string;
  redirectTo?: string;
  /** Требовать согласия перед входом: вход через VK создаёт аккаунт,
   *  значит согласия нужны так же, как при обычной регистрации */
  requireConsent?: boolean;
  /** Отмечены ли согласия */
  consentGiven?: boolean;
}

const VkAuthButton = ({
  className = '',
  redirectTo = '/profile',
  requireConsent = false,
  consentGiven = true,
}: VkAuthButtonProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { vkLogin } = useAuth();
  const navigate = useNavigate();
  const renderedRef = useRef(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadFailed(false);

    loadVkSdk()
      .then((VKID) => {
        if (cancelled || !containerRef.current || renderedRef.current) return;
        renderedRef.current = true;

        initVkConfig(VKID);

        const oneTap = new VKID.OneTap();

        oneTap
          .render({
            container: containerRef.current,
            showAlternativeLogin: true,
          })
          .on(VKID.WidgetEvents.ERROR, () => {
            toast.error('Ошибка входа через ВКонтакте');
          })
          .on(VKID.OneTapInternalEvents.LOGIN_SUCCESS, (payload: VkLoginPayload) => {
            VKID.Auth.exchangeCode(payload.code, payload.device_id)
              .then(async (data: VkExchangeData) => {
                try {
                  await vkLogin(data.access_token, { email: data.email, phone: data.phone });
                  toast.success('Вы вошли через ВКонтакте!');
                  navigate(redirectTo);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Ошибка входа');
                }
              })
              .catch(() => {
                toast.error('Ошибка входа через ВКонтакте');
              });
          });
      })
      .catch((error) => {
        console.error('VK ID SDK не загрузился:', error);
        if (!cancelled) setLoadFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [vkLogin, navigate, redirectTo, retryKey]);

  const handleRetry = () => {
    renderedRef.current = false;
    setRetryKey((k) => k + 1);
  };

  if (loadFailed) {
    return (
      <div className={`flex flex-col items-center gap-2 ${className}`}>
        <p className="text-sm text-muted-foreground text-center">
          Не удалось загрузить вход через VK
        </p>
        <button
          type="button"
          onClick={handleRetry}
          className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
        >
          <Icon name="RefreshCw" size={16} />
          Повторить
        </button>
      </div>
    );
  }

  // Виджет VK — сторонний, отключить его кнопку нельзя. Накрываем прозрачным
  // слоем: клик перехватывается и человек видит, чего не хватает
  const blocked = requireConsent && !consentGiven;

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className={`${className} ${blocked ? 'opacity-50' : ''}`}
      />
      {blocked && (
        <div
          className="absolute inset-0 z-10 cursor-not-allowed"
          onClick={() =>
            toast.error('Отметьте согласия, чтобы продолжить')
          }
          role="presentation"
        />
      )}
    </div>
  );
};

export default VkAuthButton;