import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { loadVkSdk, initVkConfig } from '@/lib/vkid';

export default function VkCallback() {
  const navigate = useNavigate();
  const { vkLogin } = useAuth();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const deviceId = params.get('device_id');

    if (!code || !deviceId) {
      navigate('/login', { replace: true });
      return;
    }

    loadVkSdk()
      .then(async (VKID) => {
        initVkConfig(VKID);
        const data = await VKID.Auth.exchangeCode(code, deviceId);
        await vkLogin(data.access_token, { email: data.email, phone: data.phone });
        toast.success('Вы вошли через ВКонтакте!');
        navigate('/profile', { replace: true });
      })
      .catch((error) => {
        console.error('VK callback ошибка:', error);
        toast.error('Не удалось завершить вход через ВКонтакте');
        navigate('/login', { replace: true });
      });
  }, [navigate, vkLogin]);

  return (
    <Layout>
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 py-12">
        <div className="text-center text-muted-foreground">
          <p className="text-lg">Завершаем вход через ВКонтакте…</p>
        </div>
      </div>
    </Layout>
  );
}