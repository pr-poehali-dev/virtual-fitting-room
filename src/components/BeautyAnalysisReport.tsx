import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
const loadHtml2Canvas = async () => (await import("html2canvas")).default;

const IMAGE_PROXY_API =
  "https://functions.poehali.dev/7f105c4b-f9e7-4df3-9f64-3d35895b8e90";

export interface NameReason {
  name: string;
  reason?: string;
}
export interface ColorItem {
  name: string;
  hex?: string;
  reason?: string;
}
export interface LookItem {
  title: string;
  description: string;
}

export type BeautyResult = Record<string, unknown>;

export type BlockDef =
  | { kind: "text"; field: string; icon: string; title: string }
  | { kind: "list"; field: string; icon: string; title: string }
  | { kind: "nameReason"; field: string; icon: string; title: string }
  | { kind: "colors"; field: string; icon: string; title: string };

export interface ReportConfig {
  header: string;
  titleField: string;
  subtitleField?: string;
  looksField: string;
  looksTitle: string;
  looksIcon: string;
  fileName: string;
  blocks: BlockDef[];
}

interface Props {
  result: BeautyResult;
  imageUrl: string | null;
  config: ReportConfig;
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

function SectionTitle({
  icon,
  children,
}: {
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <h3 className="flex items-center gap-2 text-lg font-semibold text-[#7a5c4e] mb-3">
      <Icon name={icon} size={20} />
      {children}
    </h3>
  );
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export default function BeautyAnalysisReport({
  result,
  imageUrl,
  config,
}: Props) {
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
          await new Promise((r) => setTimeout(r, 300));
        } catch {
          /* fallback to original url */
        }
      }
      const html2canvas = await loadHtml2Canvas();
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: "#fdfbf7",
        scale: 2,
        useCORS: true,
        logging: false,
        imageTimeout: 15000,
      });
      const link = document.createElement("a");
      link.download = `${config.fileName}-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Отчёт сохранён");
    } catch (e) {
      console.error("[BeautyAnalysisReport] download error", e);
      toast.error("Не удалось скачать отчёт");
    } finally {
      setIsDownloading(false);
    }
  };

  const title = asString(result[config.titleField]);
  const subtitle = config.subtitleField
    ? asString(result[config.subtitleField])
    : "";
  const looks = asArray<LookItem>(result[config.looksField]);

  const renderBlock = (block: BlockDef, key: number) => {
    const value = result[block.field];

    if (block.kind === "text") {
      const text = asString(value);
      if (!text) return null;
      return (
        <div key={key}>
          <SectionTitle icon={block.icon}>{block.title}</SectionTitle>
          <p className="text-sm text-[#6b5d50] leading-relaxed">{text}</p>
        </div>
      );
    }

    if (block.kind === "list") {
      const items = asArray<string>(value).filter(Boolean);
      if (!items.length) return null;
      return (
        <div key={key}>
          <SectionTitle icon={block.icon}>{block.title}</SectionTitle>
          <ul className="space-y-1.5">
            {items.map((t, i) => (
              <li key={i} className="text-sm text-[#6b5d50] flex gap-2">
                <Icon
                  name="Check"
                  size={16}
                  className="text-[#b89a82] mt-0.5 shrink-0"
                />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    }

    if (block.kind === "nameReason") {
      const items = asArray<NameReason>(value).filter((i) => i && i.name);
      if (!items.length) return null;
      return (
        <div key={key}>
          <SectionTitle icon={block.icon}>{block.title}</SectionTitle>
          <div className="space-y-2.5">
            {items.map((it, i) => (
              <div key={i}>
                <p className="text-sm font-medium text-[#5a4636] leading-tight">
                  {it.name}
                </p>
                {it.reason && (
                  <p className="text-xs text-[#8a7a6a] leading-snug mt-0.5">
                    {it.reason}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    const colors = asArray<ColorItem>(value).filter((c) => c && c.name);
    if (!colors.length) return null;
    return (
      <div key={key}>
        <SectionTitle icon={block.icon}>{block.title}</SectionTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {colors.map((c, i) => (
            <div key={i} className="flex items-center gap-3">
              <span
                className="w-10 h-10 rounded-lg border border-[#e0d4c4] shrink-0"
                style={{ backgroundColor: c.hex || "#ccc" }}
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#5a4636] leading-tight">
                  {c.name}
                </p>
                {c.reason && (
                  <p className="text-xs text-[#8a7a6a] leading-tight">
                    {c.reason}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={handleDownload}
          disabled={isDownloading}
          className="max-w-full min-h-10 h-auto py-2.5 whitespace-normal text-center leading-snug"
        >
          {isDownloading ? (
            <Icon
              name="Loader2"
              size={18}
              className="mr-2 animate-spin shrink-0"
            />
          ) : (
            <Icon name="Download" size={18} className="mr-2 shrink-0" />
          )}
          <span className="min-w-0">Скачать PNG</span>
        </Button>
      </div>

      <div
        ref={reportRef}
        className="bg-[#fdfbf7] rounded-xl px-2 py-4 md:p-8 space-y-8"
      >
        <div className="text-center border-b border-[#e7ddd0] pb-6">
          <p className="text-sm tracking-widest text-[#a08b7a] uppercase">
            {config.header}
          </p>
          {title && (
            <h2 className="mt-2 font-serif text-3xl md:text-4xl text-[#5a4636]">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="mt-2 text-sm text-[#8a7a6a]">{subtitle}</p>
          )}
        </div>

        {imageUrl && (
          <div>
            <SectionTitle icon={config.looksIcon}>
              {config.looksTitle}
            </SectionTitle>
            <img
              src={imgDataUrl || imageUrl}
              alt={config.looksTitle}
              className="w-full rounded-lg shadow-sm"
            />
            {looks.length > 0 && (
              <div className="grid sm:grid-cols-2 gap-3 mt-4">
                {looks.map((look, i) => (
                  <div
                    key={i}
                    className="bg-white/70 rounded-lg p-4 border border-[#eee3d6]"
                  >
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
          {config.blocks.map((b, i) => renderBlock(b, i))}
        </div>

        <div className="text-center pt-4 border-t border-[#e7ddd0]">
          <p className="text-xs tracking-widest text-[#a08b7a] uppercase">
            fitting-room.ru
          </p>
        </div>
      </div>
    </div>
  );
}