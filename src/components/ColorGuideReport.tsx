import { useEffect, useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import html2canvas from "html2canvas";

const GUIDE_IMAGES_API = "https://functions.poehali.dev/6df158f5-ce47-4f8c-9fad-c312c737757e";
const IMAGE_PROXY_API = "https://functions.poehali.dev/7f105c4b-f9e7-4df3-9f64-3d35895b8e90";

async function fetchAsDataUrl(url: string): Promise<string> {
  try {
    const response = await fetch(IMAGE_PROXY_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: url }),
    });
    if (!response.ok) throw new Error("proxy fetch failed");
    const data = await response.json();
    return data.data_url || url;
  } catch (e) {
    console.error("[ColorGuide] Proxy error for", url, e);
    return url;
  }
}

export interface ColorGuideResult {
  colortype_slug: string;
  colortype_name: string;
  short_description: string;
  appearance?: {
    undertone?: string;
    contrast?: string;
    characteristics?: string[];
  };
  main_palette: Array<{ name: string; hex: string }>;
  avoid_palette: Array<{ name: string; hex: string }>;
  makeup: {
    lipstick: Array<{ name: string; hex: string }>;
    blush: Array<{ name: string; hex: string }>;
    eyeshadow: Array<{ name: string; hex: string }>;
  };
  metals: {
    recommended: string[];
    avoid: string[];
  };
  hair_colors: Array<{ name: string; hex: string; description?: string }>;
  capsules: Array<{ name: string; colors: string[] }>;
  tips: {
    wear: string[];
    avoid: string[];
  };
}

interface ColorGuideReportProps {
  result: ColorGuideResult;
  photoUrl: string;
}

interface GuideImages {
  hair: string[];
  makeup: string[];
  outfit: string[];
  jewelry: string[];
  texture: string[];
  other: string[];
}

export default function ColorGuideReport({ result, photoUrl }: ColorGuideReportProps) {
  const [images, setImages] = useState<GuideImages | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string>(photoUrl);
  const [isDownloading, setIsDownloading] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // Proxy user photo through image-proxy to bypass CORS
  useEffect(() => {
    let cancelled = false;
    if (!photoUrl) return;
    // data: URLs пропускаем — это локально загруженное фото перед обработкой
    if (photoUrl.startsWith("data:")) {
      setPhotoDataUrl(photoUrl);
      return;
    }
    fetchAsDataUrl(photoUrl).then((dataUrl) => {
      if (!cancelled) setPhotoDataUrl(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [photoUrl]);

  // Load guide images list and proxy each one
  useEffect(() => {
    let cancelled = false;
    fetch(`${GUIDE_IMAGES_API}?slug=${encodeURIComponent(result.colortype_slug)}`)
      .then((r) => r.json())
      .then(async (data) => {
        if (cancelled) return;
        if (!data || !data.images) return;
        const src: GuideImages = data.images;
        const proxyList = async (urls: string[], limit: number) => {
          const sliced = urls.slice(0, limit);
          return Promise.all(sliced.map((u) => fetchAsDataUrl(u)));
        };
        const [outfit, texture, makeup, jewelry, hair] = await Promise.all([
          proxyList(src.outfit || [], 4),
          proxyList(src.texture || [], 2),
          proxyList(src.makeup || [], 1),
          proxyList(src.jewelry || [], 1),
          proxyList(src.hair || [], 0),
        ]);
        if (cancelled) return;
        setImages({
          outfit,
          texture,
          makeup,
          jewelry,
          hair,
          other: [],
        });
      })
      .catch((e) => {
        console.error("[ColorGuide] Failed to load guide images:", e);
      });
    return () => {
      cancelled = true;
    };
  }, [result.colortype_slug]);

  const handleDownloadPng = async () => {
    if (!reportRef.current) return;
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        imageTimeout: 15000,
      });
      const link = document.createElement("a");
      link.download = `color-guide-${result.colortype_slug}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Отчёт сохранён");
    } catch (e) {
      console.error("[ColorGuide] Download error:", e);
      toast.error("Не удалось скачать отчёт");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-end">
        <Button onClick={handleDownloadPng} disabled={isDownloading} variant="default">
          {isDownloading ? (
            <>
              <Icon name="Loader2" className="mr-2 animate-spin" size={18} />
              Сохраняем...
            </>
          ) : (
            <>
              <Icon name="Download" className="mr-2" size={18} />
              Скачать PNG
            </>
          )}
        </Button>
      </div>

      <div ref={reportRef} className="bg-white text-gray-900 rounded-2xl overflow-hidden shadow-xl">
        {/* Header */}
        <div className="p-8 md:p-10 bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 border-b">
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
            <div className="flex-shrink-0">
              <img
                src={photoDataUrl}
                alt="Фото"
                className="w-40 h-52 object-cover rounded-xl border-4 border-white shadow-lg"
              />
            </div>
            <div className="flex-1 text-center md:text-left">
              <p className="text-sm uppercase tracking-widest text-purple-600 mb-2 font-medium">
                Ваш гид по цвету
              </p>
              <h1 className="text-4xl md:text-5xl font-light mb-3 text-gray-900">
                {result.colortype_name}
              </h1>
              <p className="text-gray-700 leading-relaxed mb-4">{result.short_description}</p>
              {result.appearance && (
                <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                  {result.appearance.undertone && (
                    <span className="px-3 py-1 bg-white/70 rounded-full text-xs text-gray-700 border border-purple-200">
                      Подтон: {result.appearance.undertone}
                    </span>
                  )}
                  {result.appearance.contrast && (
                    <span className="px-3 py-1 bg-white/70 rounded-full text-xs text-gray-700 border border-purple-200">
                      Контраст: {result.appearance.contrast}
                    </span>
                  )}
                  {result.appearance.characteristics?.map((c, i) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-white/70 rounded-full text-xs text-gray-700 border border-purple-200"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-8 md:p-10 space-y-10">
          {/* Main palette */}
          <section>
            <h2 className="text-2xl font-light mb-1 text-gray-900">Ваша палитра</h2>
            <p className="text-sm text-gray-500 mb-5">Цвета, в которых вы выглядите наиболее выигрышно</p>
            <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
              {result.main_palette?.map((c, i) => (
                <div key={i} className="space-y-1.5">
                  <div
                    className="aspect-square rounded-lg border border-gray-200 shadow-sm"
                    style={{ backgroundColor: c.hex }}
                    title={c.name}
                  />
                  <p className="text-xs text-gray-600 text-center leading-tight">{c.name}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Avoid palette */}
          {result.avoid_palette && result.avoid_palette.length > 0 && (
            <section>
              <h2 className="text-2xl font-light mb-1 text-gray-900">Избегайте этих цветов</h2>
              <p className="text-sm text-gray-500 mb-5">Эти оттенки могут делать вид уставшим</p>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {result.avoid_palette.map((c, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="relative aspect-square rounded-lg border border-gray-200 shadow-sm overflow-hidden" style={{ backgroundColor: c.hex }}>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-full h-0.5 bg-red-500 transform rotate-45 absolute" />
                        <div className="w-full h-0.5 bg-red-500 transform -rotate-45 absolute" />
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 text-center leading-tight">{c.name}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Outfit images */}
          {images && images.outfit && images.outfit.length > 0 && (
            <section>
              <h2 className="text-2xl font-light mb-1 text-gray-900">Примеры одежды</h2>
              <p className="text-sm text-gray-500 mb-5">Сочетания цветов, которые работают</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {images.outfit.slice(0, 4).map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Образ ${i + 1}`}
                    className="w-full aspect-square object-cover rounded-xl border border-gray-200"
                  />
                ))}
              </div>
            </section>
          )}

          {/* Texture */}
          {images && images.texture && images.texture.length > 0 && (
            <section>
              <h2 className="text-2xl font-light mb-1 text-gray-900">Подходящие текстуры</h2>
              <p className="text-sm text-gray-500 mb-5">Ткани и материалы вашей палитры</p>
              <div className="grid grid-cols-1 gap-4">
                {images.texture.slice(0, 2).map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Текстура ${i + 1}`}
                    className="w-full aspect-[16/9] object-cover rounded-xl border border-gray-200"
                  />
                ))}
              </div>
            </section>
          )}

          {/* Makeup */}
          {result.makeup && (
            <section>
              <h2 className="text-2xl font-light mb-1 text-gray-900">Макияж</h2>
              <p className="text-sm text-gray-500 mb-5">Оттенки помады, румян и теней</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MakeupBlock title="Помада" icon="Heart" items={result.makeup.lipstick} />
                <MakeupBlock title="Румяна" icon="Flower" items={result.makeup.blush} />
                <MakeupBlock title="Тени" icon="Eye" items={result.makeup.eyeshadow} />
              </div>
              {images && images.makeup && images.makeup.length > 0 && (
                <div className="mt-5 grid grid-cols-1 gap-4">
                  {images.makeup.slice(0, 1).map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`Косметика ${i + 1}`}
                      className="w-full aspect-[16/9] object-cover rounded-xl border border-gray-200"
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Metals + Jewelry */}
          {result.metals && (
            <section>
              <h2 className="text-2xl font-light mb-1 text-gray-900">Украшения и металлы</h2>
              <p className="text-sm text-gray-500 mb-5">Какие металлы подсветят вашу внешность</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon name="Check" className="text-green-600" size={18} />
                    <h3 className="font-medium text-green-900">Подходят</h3>
                  </div>
                  <ul className="space-y-1.5 text-sm text-gray-700">
                    {result.metals.recommended?.map((m, i) => (
                      <li key={i}>• {m}</li>
                    ))}
                  </ul>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon name="X" className="text-red-600" size={18} />
                    <h3 className="font-medium text-red-900">Не подходят</h3>
                  </div>
                  <ul className="space-y-1.5 text-sm text-gray-700">
                    {result.metals.avoid?.map((m, i) => (
                      <li key={i}>• {m}</li>
                    ))}
                  </ul>
                </div>
              </div>
              {images && images.jewelry && images.jewelry.length > 0 && (
                <div className="grid grid-cols-1 gap-4">
                  {images.jewelry.slice(0, 1).map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`Украшения ${i + 1}`}
                      className="w-full aspect-[16/9] object-cover rounded-xl border border-gray-200"
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Hair colors */}
          {result.hair_colors && result.hair_colors.length > 0 && (
            <section>
              <h2 className="text-2xl font-light mb-1 text-gray-900">Цвета волос</h2>
              <p className="text-sm text-gray-500 mb-5">Оттенки окрашивания, которые подчеркнут вашу внешность</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {result.hair_colors.map((h, i) => (
                  <div key={i} className="text-center">
                    <div
                      className="w-full aspect-square rounded-xl border border-gray-200 shadow-sm mb-2"
                      style={{ backgroundColor: h.hex }}
                    />
                    <p className="text-sm font-medium text-gray-900">{h.name}</p>
                    {h.description && (
                      <p className="text-xs text-gray-500 mt-0.5 leading-tight">{h.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Capsules */}
          {result.capsules && result.capsules.length > 0 && (
            <section>
              <h2 className="text-2xl font-light mb-1 text-gray-900">Капсульные сочетания</h2>
              <p className="text-sm text-gray-500 mb-5">Готовые комбинации цветов для разных образов</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.capsules.map((cap, i) => (
                  <div key={i} className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                    <p className="text-sm font-medium mb-3 text-gray-900">{cap.name}</p>
                    <div className="flex gap-2">
                      {cap.colors.map((c, j) => (
                        <div
                          key={j}
                          className="flex-1 aspect-square rounded-lg border border-gray-200 shadow-sm"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Tips */}
          {result.tips && (
            <section>
              <h2 className="text-2xl font-light mb-1 text-gray-900">Советы стилиста</h2>
              <p className="text-sm text-gray-500 mb-5">Что носить и чего избегать</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon name="Sparkles" className="text-purple-600" size={18} />
                    <h3 className="font-medium text-purple-900">Носите</h3>
                  </div>
                  <ul className="space-y-2 text-sm text-gray-700">
                    {result.tips.wear?.map((t, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-purple-500">•</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon name="AlertCircle" className="text-gray-600" size={18} />
                    <h3 className="font-medium text-gray-900">Избегайте</h3>
                  </div>
                  <ul className="space-y-2 text-sm text-gray-700">
                    {result.tips.avoid?.map((t, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-gray-500">•</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 md:px-10 py-6 bg-gradient-to-r from-purple-50 to-pink-50 border-t text-center">
          <p className="text-sm text-gray-600">
            Ваш гид по цвету · fitting-room.ru
          </p>
        </div>
      </div>
    </div>
  );
}

function MakeupBlock({
  title,
  icon,
  items,
}: {
  title: string;
  icon: string;
  items?: Array<{ name: string; hex: string }>;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon name={icon} className="text-pink-600" size={18} />
        <h3 className="font-medium text-gray-900">{title}</h3>
      </div>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full border border-gray-300 shadow-sm flex-shrink-0"
              style={{ backgroundColor: it.hex }}
            />
            <span className="text-sm text-gray-700">{it.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}