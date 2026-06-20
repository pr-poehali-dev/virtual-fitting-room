import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import {
  loadVkSdk,
  initVkConfig,
  type VkExchangeData,
  type VkLoginPayload,
} from '@/lib/vkid';

interface VkAuthButtonProps {
  className?: string;
  redirectTo?: string;
}

const VkAuthButton = ({ className = '', redirectTo = '/profile' }: VkAuthButtonProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { vkLogin } = useAuth();
  const navigate = useNavigate();
  const renderedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

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
      });

    return () => {
      cancelled = true;
    };
  }, [vkLogin, navigate, redirectTo]);

  return <div ref={containerRef} className={className} />;
};

export default VkAuthButton;