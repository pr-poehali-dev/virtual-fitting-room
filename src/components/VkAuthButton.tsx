import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

const VK_APP_ID = 54642627;
const VK_REDIRECT_URL = 'https://fitting-room.ru/auth/vk/callback';
const VK_SDK_SRC = 'https://unpkg.com/@vkid/sdk@^3.0.0/dist-sdk/umd/index.js';

interface VkExchangeData {
  access_token: string;
  email?: string;
  phone?: string;
}

interface VkLoginPayload {
  code: string;
  device_id: string;
}

interface VkOneTap {
  render: (options: { container: HTMLElement; showAlternativeLogin: boolean }) => VkOneTap;
  on: (event: unknown, cb: (payload: VkLoginPayload) => void) => VkOneTap;
}

interface VkIdSdk {
  Config: { init: (config: Record<string, unknown>) => void };
  ConfigResponseMode: { Callback: unknown };
  ConfigSource: { LOWCODE: unknown };
  WidgetEvents: { ERROR: unknown };
  OneTapInternalEvents: { LOGIN_SUCCESS: unknown };
  OneTap: new () => VkOneTap;
  Auth: { exchangeCode: (code: string, deviceId: string) => Promise<VkExchangeData> };
}

declare global {
  interface Window {
    VKIDSDK?: VkIdSdk;
  }
}

let sdkPromise: Promise<VkIdSdk> | null = null;

function loadVkSdk(): Promise<VkIdSdk> {
  if (window.VKIDSDK) return Promise.resolve(window.VKIDSDK);
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = VK_SDK_SRC;
    script.async = true;
    script.onload = () => {
      if (window.VKIDSDK) resolve(window.VKIDSDK);
      else reject(new Error('VK ID SDK не загрузился'));
    };
    script.onerror = () => reject(new Error('Не удалось загрузить VK ID SDK'));
    document.head.appendChild(script);
  });

  return sdkPromise;
}

interface VkAuthButtonProps {
  className?: string;
}

const VkAuthButton = ({ className = '' }: VkAuthButtonProps) => {
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

        VKID.Config.init({
          app: VK_APP_ID,
          redirectUrl: VK_REDIRECT_URL,
          responseMode: VKID.ConfigResponseMode.Callback,
          source: VKID.ConfigSource.LOWCODE,
          scope: 'email phone',
        });

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
                  navigate('/profile');
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Ошибка входа');
                }
              })
              .catch(() => {
                toast.error('Ошибка входа через ВКонтакте');
              });
          });
      })
      .catch(() => {
        /* SDK не загрузился — кнопка просто не появится */
      });

    return () => {
      cancelled = true;
    };
  }, [vkLogin, navigate]);

  return <div ref={containerRef} className={className} />;
};

export default VkAuthButton;
