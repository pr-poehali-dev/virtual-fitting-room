export const VK_APP_ID = 54642627;
export const VK_REDIRECT_URL = 'https://fitting-room.ru/auth/vk/callback';
export const VK_SDK_SOURCES = [
  'https://cdn.jsdelivr.net/npm/@vkid/sdk@^2.0.0/dist-sdk/umd/index.js',
  'https://unpkg.com/@vkid/sdk@^2.0.0/dist-sdk/umd/index.js',
];
export const VK_SDK_SRC = VK_SDK_SOURCES[0];

export interface VkExchangeData {
  access_token: string;
  email?: string;
  phone?: string;
}

export interface VkLoginPayload {
  code: string;
  device_id: string;
}

export interface VkOneTap {
  render: (options: { container: HTMLElement; showAlternativeLogin: boolean }) => VkOneTap;
  on: (event: unknown, cb: (payload: VkLoginPayload) => void) => VkOneTap;
}

export interface VkIdSdk {
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

function loadScript(src: string): Promise<VkIdSdk> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
      if (window.VKIDSDK) resolve(window.VKIDSDK);
      else reject(new Error('VK ID SDK не загрузился'));
    };
    script.onerror = () => {
      script.remove();
      reject(new Error('Не удалось загрузить VK ID SDK'));
    };
    document.head.appendChild(script);
  });
}

export function loadVkSdk(): Promise<VkIdSdk> {
  if (window.VKIDSDK) return Promise.resolve(window.VKIDSDK);
  if (sdkPromise) return sdkPromise;

  sdkPromise = (async () => {
    let lastError: unknown = new Error('Не удалось загрузить VK ID SDK');
    for (const src of VK_SDK_SOURCES) {
      try {
        return await loadScript(src);
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError;
  })();

  sdkPromise.catch(() => {
    sdkPromise = null;
  });

  return sdkPromise;
}

export function initVkConfig(VKID: VkIdSdk) {
  VKID.Config.init({
    app: VK_APP_ID,
    redirectUrl: VK_REDIRECT_URL,
    responseMode: VKID.ConfigResponseMode.Callback,
    source: VKID.ConfigSource.LOWCODE,
    scope: 'email phone',
  });
}