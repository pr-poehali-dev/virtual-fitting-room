import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import { JewelryFormParams } from "@/lib/travelOptions";

const IMAGE_PROXY_API =
  "https://functions.poehali.dev/7f105c4b-f9e7-4df3-9f64-3d35895b8e90";

interface NamedItem {
  name?: string;
  description?: string;
}

interface Swatch {
  name?: string;
  hex?: string;
}

export interface JewelryResult {
  title?: string;
  summary?: string;
  scale_analysis?: string;
  color_analysis?: string;
  personal_fit?: string;
  metals?: Swatch[];
  stones?: Swatch[];
  best?: string[];
  avoid?: string[];
  sets?: {
    title?: string;
    occasion?: string;
    description?: string;
    items?: NamedItem[];
    wear_with?: string;
  }[];
  tips?: string[];
}

interface Props {
  imageUrl: string | null;
  data: JewelryResult | null;
  formParams?: JewelryFormParams | null;
  onReset: () => void;
  onEdit?: () => void;
}

async function fetchAsBlob(url: string): Promise<Blob> {
  if (url.includes("cdn.poehali.dev")) return (await fetch(url)).blob();
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
  return (await fetch(data.data_url)).blob();
}

function SectionTitle({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-lg font-semibold text-primary mb-3">
      <Icon name={icon} size={20} />
      {children}
    </h3>
  );
}

function Swatches({ items }: { items?: Swatch[] }) {
  if (!items?.length) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {items.map((c, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="inline-block h-8 w-8 rounded-full border"
            style={{ backgroundColor: c.hex || "#ccc" }}
          />
          <span className="text-sm font-medium">{c.name}</span>
        </div>
      ))}
    </div>
  );
}

function BulletList({ items, icon, color }: { items?: string[]; icon: string; color: string }) {
  if (!items?.length) return null;
  return (
    <ul className="space-y-2">
      {items.map((t, i) => (
        <li key={i} className="flex gap-2 text-sm">
          <Icon name={icon} size={16} className={`mt-0.5 shrink-0 ${color}`} />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

function paramRows(fp?: JewelryFormParams | null) {
  if (!fp) return [];
  const rows: { label: string; value: string }[] = [];
  const add = (label: string, v?: string | number | string[]) => {
    if (v === undefined || v === null) return;
    const s = Array.isArray(v) ? v.filter(Boolean).join(", ") : `${v}`.trim();
    if (s) rows.push({ label, value: s });
  };
  add("Поводы", fp.occasions);
  add("Металл", fp.metal);
  add("Камни", fp.stones);
  add("Что носите", fp.jewelry_types);
  add("Уши проколоты", fp.ears_pierced);
  add("Бюджет", fp.budget);
  add("Не носите", fp.jewelry_dislikes);
  add("Пол", fp.gender);
  add("Типаж по Кибби", fp.kibbe);
  add("Архетипы", fp.archetypes);
  add("Цветотип", fp.colortypes);
  return rows;
}

export default function JewelryReport({ imageUrl, data, formParams, onReset, onEdit }: Props) {
  const rows = paramRows(formParams);

  const handleDownload = async () => {
    if (!imageUrl) return;
    try {
      const blob = await fetchAsBlob(imageUrl);
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `jewelry-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
      toast.success("Картинка скачана");
    } catch {
      toast.error("Ошибка скачивания");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {imageUrl && (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <img src={imageUrl} alt="Три набора украшений" className="w-full object-contain bg-muted" />
          </CardContent>
        </Card>
      )}

      {data && (
        <Card>
          <CardContent className="p-6 md:p-8 space-y-7">
            <div className="text-center">
              <p className="text-sm uppercase tracking-wide text-muted-foreground">
                Подбор украшений
              </p>
              {data.title && <h2 className="text-3xl font-light mt-1">{data.title}</h2>}
              {data.summary && (
                <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">{data.summary}</p>
              )}
            </div>

            {(data.scale_analysis || data.color_analysis) && (
              <div className="grid md:grid-cols-2 gap-6">
                {data.scale_analysis && (
                  <div>
                    <SectionTitle icon="Ruler">Масштаб и формы</SectionTitle>
                    <p className="text-sm text-muted-foreground">{data.scale_analysis}</p>
                  </div>
                )}
                {data.color_analysis && (
                  <div>
                    <SectionTitle icon="Palette">Колорит</SectionTitle>
                    <p className="text-sm text-muted-foreground">{data.color_analysis}</p>
                  </div>
                )}
              </div>
            )}

            {data.personal_fit && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
                <SectionTitle icon="UserCheck">Почему эти украшения — ваши</SectionTitle>
                <p className="text-sm text-muted-foreground">{data.personal_fit}</p>
              </div>
            )}

            {(!!data.metals?.length || !!data.stones?.length) && (
              <div className="grid md:grid-cols-2 gap-6">
                {!!data.metals?.length && (
                  <div>
                    <SectionTitle icon="CircleDot">Ваши металлы</SectionTitle>
                    <Swatches items={data.metals} />
                  </div>
                )}
                {!!data.stones?.length && (
                  <div>
                    <SectionTitle icon="Gem">Ваши камни</SectionTitle>
                    <Swatches items={data.stones} />
                  </div>
                )}
              </div>
            )}

            {(!!data.best?.length || !!data.avoid?.length) && (
              <div className="grid md:grid-cols-2 gap-6">
                {!!data.best?.length && (
                  <div>
                    <SectionTitle icon="ThumbsUp">Что вам идёт</SectionTitle>
                    <BulletList items={data.best} icon="Check" color="text-primary" />
                  </div>
                )}
                {!!data.avoid?.length && (
                  <div>
                    <SectionTitle icon="Ban">Чего избегать</SectionTitle>
                    <BulletList items={data.avoid} icon="X" color="text-destructive" />
                  </div>
                )}
              </div>
            )}

            {!!data.sets?.length && (
              <div>
                <SectionTitle icon="Sparkles">Наборы</SectionTitle>
                <div className="grid md:grid-cols-3 gap-4">
                  {data.sets.map((set, i) => (
                    <div key={i} className="rounded-xl border p-4 flex flex-col">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Набор {i + 1}
                        {set.occasion ? ` · ${set.occasion}` : ""}
                      </p>
                      <p className="font-semibold mt-1 mb-2">{set.title}</p>
                      {set.description && (
                        <p className="text-sm text-muted-foreground mb-3">{set.description}</p>
                      )}
                      <ul className="space-y-1.5 mb-3">
                        {(set.items || []).map((it, j) => (
                          <li key={j} className="text-sm">
                            {it.name && <span className="font-medium">{it.name}</span>}
                            {it.name && it.description && " — "}
                            {it.description && (
                              <span className="text-muted-foreground">{it.description}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                      {set.wear_with && (
                        <p className="text-sm mt-auto pt-3 border-t">
                          <span className="font-medium">С чем носить: </span>
                          <span className="text-muted-foreground">{set.wear_with}</span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!!data.tips?.length && (
              <div>
                <SectionTitle icon="Lightbulb">Советы стилиста</SectionTitle>
                <BulletList items={data.tips} icon="Check" color="text-primary" />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {rows.length > 0 && (
        <Card>
          <CardContent className="p-6 md:p-8">
            <SectionTitle icon="SlidersHorizontal">Подобрано по параметрам</SectionTitle>
            <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-2">
              {rows.map((r) => (
                <div
                  key={r.label}
                  className="flex justify-between gap-3 border-b border-border/60 py-1.5 text-sm"
                >
                  <dt className="text-muted-foreground shrink-0">{r.label}</dt>
                  <dd className="text-right font-medium">{r.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row justify-center gap-3">
        {imageUrl && (
          <Button onClick={handleDownload} variant="outline">
            <Icon name="Download" size={18} className="mr-2" />
            Скачать картинку
          </Button>
        )}
        {onEdit && (
          <Button onClick={onEdit} variant="outline">
            <Icon name="Pencil" size={18} className="mr-2" />
            Изменить параметры
          </Button>
        )}
        <Button onClick={onReset}>
          <Icon name="RotateCcw" size={18} className="mr-2" />
          Подобрать заново
        </Button>
      </div>
    </div>
  );
}
