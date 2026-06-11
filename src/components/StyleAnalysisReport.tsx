import { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import html2canvas from "html2canvas";

const IMAGE_PROXY_API = "https://functions.poehali.dev/7f105c4b-f9e7-4df3-9f64-3d35895b8e90";

interface NameReason {
  name: string;
  reason?: string;
}
interface ColorItem {
  name: string;
  hex?: string;
  reason?: string;
}
interface LookItem {
  title: string;
  description: string;
}

export interface StyleAnalysisResult {
  identity?: string;
  color_analysis?: string;
  body_analysis?: string;
  vibe?: string[];
  best_styles?: NameReason[];
  avoid_styles?: string[];
  palette_best?: ColorItem[];
  palette_avoid?: ColorItem[];
  silhouettes?: NameReason[];
  key_items?: NameReason[];
  accessories?: string[];
  tips?: string[];
  looks?: LookItem[];
  source_image?: string;
}

interface Props {
  result: StyleAnalysisResult;
  imageUrl: string | null;
}

async function fetchAsBlob(url: string): Promise<Blob> {
  const needsProxy = !url.includes("cdn.poehali.dev");
  if (needsProxy) {
    const sessionToken = localStorage.getItem("session_token");
    const res = await fetch(IMAGE_PROXY_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionToken ? { "X-Session-Token": sessionToken } : {}),
      },
      credentials: "include",
      body: JSON.stringify({ image_url: url }),
    });
    if (!res.ok) throw new Error("proxy failed");
    const data = await res.json();
    const r = await fetch(data.data_url);
    return r.blob();
  }
  const r = await fetch(url);
  return r.blob();
}

function SectionTitle({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-lg font-semibold text-[#7a5c4e] mb-3">
      <Icon name={icon} size={20} />
      {children}
    </h3>
  );
}

export default function StyleAnalysisReport({ result, imageUrl }: Props) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [imgDataUrl, setImgDataUrl] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!reportRef.current) return;
    setIsDownloading(true);
    try {
      if (imageUrl && !imgDataUrl) {
        try {
          const blob = await fetchAsBlob(imageUrl);
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          setImgDataUrl(dataUrl);
          await new Promise((r) => setTimeout(r, 150));
        } catch {
          /* fallback to original url */
        }
      }
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: "#fdfbf7",
        scale: 2,
        useCORS: true,
        logging: false,
        imageTimeout: 15000,
      });
      const link = document.createElement("a");
      link.download = `style-analysis-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Отчёт сохранён");
    } catch (e) {
      console.error("[StyleAnalysisReport] download error", e);
      toast.error("Не удалось скачать отчёт");
    } finally {
      setIsDownloading(false);
    }
  };

  const {
    identity,
    color_analysis,
    body_analysis,
    vibe,
    best_styles,
    avoid_styles,
    palette_best,
    palette_avoid,
    silhouettes,
    key_items,
    accessories,
    tips,
    looks,
    source_image,
  } = result;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleDownload} disabled={isDownloading}>
          {isDownloading ? (
            <Icon name="Loader2" size={18} className="mr-2 animate-spin" />
          ) : (
            <Icon name="Download" size={18} className="mr-2" />
          )}
          Скачать PNG
        </Button>
      </div>

      <div ref={reportRef} className="bg-[#fdfbf7] rounded-xl p-4 md:p-8 space-y-8">
        <div className="text-center border-b border-[#e7ddd0] pb-6">
          <p className="text-sm tracking-widest text-[#a08b7a] uppercase">
            Стилевой анализ внешности
          </p>
          {identity && (
            <h2 className="mt-2 font-serif text-3xl md:text-4xl text-[#5a4636]">{identity}</h2>
          )}
          {source_image && (
            <img
              src={source_image}
              alt="Исходное фото"
              className="mt-4 mx-auto w-28 h-28 object-cover object-top rounded-full shadow-sm border border-[#e7ddd0]"
            />
          )}
        </div>

        {/* Образы */}
        {imageUrl && (
          <div>
            <SectionTitle icon="Sparkles">Твои образы</SectionTitle>
            <img
              src={imgDataUrl || imageUrl}
              alt="Образы"
              className="w-full rounded-lg shadow-sm"
            />
            {looks && looks.length > 0 && (
              <div className="grid sm:grid-cols-2 gap-3 mt-4">
                {looks.map((look, i) => (
                  <div key={i} className="bg-white/70 rounded-lg p-4 border border-[#eee3d6]">
                    <p className="font-semibold text-[#5a4636] mb-1">
                      {i + 1}. {look.title}
                    </p>
                    <p className="text-sm text-[#6b5d50]">{look.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          {/* Внешность */}
          {(color_analysis || body_analysis) && (
            <div>
              <SectionTitle icon="ScanFace">Твоя внешность</SectionTitle>
              {color_analysis && (
                <p className="text-sm text-[#6b5d50] mb-3">
                  <span className="font-medium text-[#5a4636]">Колорит. </span>
                  {color_analysis}
                </p>
              )}
              {body_analysis && (
                <p className="text-sm text-[#6b5d50]">
                  <span className="font-medium text-[#5a4636]">Фигура. </span>
                  {body_analysis}
                </p>
              )}
            </div>
          )}

          {/* Вайб */}
          {vibe && vibe.length > 0 && (
            <div>
              <SectionTitle icon="Heart">Твой вайб</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {vibe.map((v, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-full bg-[#efe4d6] text-[#6b5240] text-sm"
                  >
                    {v}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Палитра */}
        {palette_best && palette_best.length > 0 && (
          <div>
            <SectionTitle icon="Palette">Твоя палитра</SectionTitle>
            <p className="text-sm text-[#5a4636] font-medium mb-2">Лучшие цвета</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {palette_best.map((c, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span
                    className="w-10 h-10 rounded-lg border border-[#e0d4c4] shrink-0"
                    style={{ backgroundColor: c.hex || "#ccc" }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#5a4636] leading-tight">{c.name}</p>
                    {c.reason && (
                      <p className="text-xs text-[#8a7a6a] leading-tight">{c.reason}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {palette_avoid && palette_avoid.length > 0 && (
              <>
                <p className="text-sm text-[#5a4636] font-medium mt-5 mb-2">Избегать</p>
                <div className="flex flex-wrap gap-3">
                  {palette_avoid.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span
                        className="w-7 h-7 rounded-md border border-[#e0d4c4]"
                        style={{ backgroundColor: c.hex || "#ccc" }}
                      />
                      <span className="text-xs text-[#8a7a6a]">{c.name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          {/* Лучшие стили */}
          {best_styles && best_styles.length > 0 && (
            <div>
              <SectionTitle icon="Shirt">Твои лучшие стили</SectionTitle>
              <ul className="space-y-2">
                {best_styles.map((s, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium text-[#5a4636]">{s.name}</span>
                    {s.reason && <span className="text-[#6b5d50]"> — {s.reason}</span>}
                  </li>
                ))}
              </ul>
              {avoid_styles && avoid_styles.length > 0 && (
                <p className="text-sm text-[#8a7a6a] mt-3">
                  <span className="font-medium">Менее подходит: </span>
                  {avoid_styles.join(", ")}
                </p>
              )}
            </div>
          )}

          {/* Силуэты */}
          {silhouettes && silhouettes.length > 0 && (
            <div>
              <SectionTitle icon="Triangle">Выигрышные силуэты</SectionTitle>
              <ul className="space-y-2">
                {silhouettes.map((s, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium text-[#5a4636]">{s.name}</span>
                    {s.reason && <span className="text-[#6b5d50]"> — {s.reason}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Ключевые вещи */}
        {key_items && key_items.length > 0 && (
          <div>
            <SectionTitle icon="ShoppingBag">Ключевые вещи гардероба</SectionTitle>
            <div className="grid sm:grid-cols-2 gap-3">
              {key_items.map((it, i) => (
                <div key={i} className="bg-white/70 rounded-lg p-3 border border-[#eee3d6]">
                  <p className="text-sm font-medium text-[#5a4636]">{it.name}</p>
                  {it.reason && <p className="text-xs text-[#8a7a6a] mt-0.5">{it.reason}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          {/* Аксессуары */}
          {accessories && accessories.length > 0 && (
            <div>
              <SectionTitle icon="Gem">Аксессуары</SectionTitle>
              <ul className="space-y-1.5">
                {accessories.map((a, i) => (
                  <li key={i} className="text-sm text-[#6b5d50] flex gap-2">
                    <Icon name="Dot" size={18} className="text-[#b89a82] shrink-0" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Советы */}
          {tips && tips.length > 0 && (
            <div>
              <SectionTitle icon="Lightbulb">Стилевые заметки</SectionTitle>
              <ul className="space-y-1.5">
                {tips.map((t, i) => (
                  <li key={i} className="text-sm text-[#6b5d50] flex gap-2">
                    <Icon name="Check" size={16} className="text-[#b89a82] mt-0.5 shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="text-center pt-4 border-t border-[#e7ddd0]">
          <p className="text-xs tracking-widest text-[#a08b7a] uppercase">fitting-room.ru</p>
        </div>
      </div>
    </div>
  );
}