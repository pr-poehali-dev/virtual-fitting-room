import { toast } from "sonner";

const IMAGE_PROXY =
  "https://functions.poehali.dev/7f105c4b-f9e7-4df3-9f64-3d35895b8e90";

const loadHtml2Canvas = async () => (await import("html2canvas")).default;

// Кэш картинок карт: один и тот же снимок делают по нескольку раз
const cardDataUrlCache = new Map<string, string>();

/** Картинка карты как data-url через прокси — иначе снимок её не захватит */
const fetchCardDataUrl = async (url: string): Promise<string | null> => {
  if (cardDataUrlCache.has(url)) return cardDataUrlCache.get(url)!;
  try {
    const res = await fetch(`${IMAGE_PROXY}?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.data_url) {
      cardDataUrlCache.set(url, data.data_url);
      return data.data_url;
    }
    return null;
  } catch {
    return null;
  }
};

const inlineCardImages = async (root: HTMLElement) => {
  const imgs = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
  await Promise.all(
    imgs.map(async (img) => {
      if (img.src.startsWith("data:")) return;
      const dataUrl = await fetchCardDataUrl(img.src);
      if (dataUrl) img.src = dataUrl;
    }),
  );
};

const waitForImages = async (root: HTMLElement) => {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  );
};

/** Снимок блока с раскладом: карты + текст толкования одной картинкой */
export const buildReadingPng = async (
  node: HTMLElement,
): Promise<Blob | null> => {
  await inlineCardImages(node);
  await waitForImages(node);
  const html2canvas = await loadHtml2Canvas();
  const canvas = await html2canvas(node, {
    backgroundColor: "#faf7ff",
    scale: 2,
    useCORS: true,
    imageTimeout: 15000,
  });
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png"),
  );
};

/** Скачивает расклад картинкой */
export const downloadReadingPng = async (node: HTMLElement | null) => {
  if (!node) return;
  try {
    const blob = await buildReadingPng(node);
    if (!blob) throw new Error("no blob");
    const link = document.createElement("a");
    link.download = `raskad-${Date.now()}.png`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success("Картинка сохранена");
  } catch {
    toast.error("Не удалось сохранить картинку");
  }
};

/**
 * Отправляет расклад КАРТИНКОЙ: на телефоне открывается системное меню,
 * на компьютере картинка просто сохраняется.
 */
export const shareReadingPng = async (node: HTMLElement | null) => {
  if (!node) return;
  try {
    const blob = await buildReadingPng(node);
    if (!blob) throw new Error("no blob");

    const file = new File([blob], `raskad-${Date.now()}.png`, {
      type: "image/png",
    });
    const nav = navigator as Navigator & {
      canShare?: (data: { files: File[] }) => boolean;
      share?: (data: {
        files?: File[];
        title?: string;
        text?: string;
      }) => Promise<void>;
    };

    if (nav.canShare?.({ files: [file] }) && nav.share) {
      await nav.share({
        files: [file],
        title: "Мой расклад",
        text: "Толкование расклада",
      });
      return;
    }

    // Без системного «Поделиться» просто сохраняем — результат не теряется
    const link = document.createElement("a");
    link.download = file.name;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success("Картинка сохранена");
  } catch (e) {
    // Человек мог сам закрыть окно «Поделиться» — это не ошибка
    if ((e as Error)?.name === "AbortError") return;
    toast.error("Не удалось поделиться раскладом");
  }
};
