import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import { TravelFormParams } from "@/lib/travelOptions";

const IMAGE_PROXY_API =
  "https://functions.poehali.dev/7f105c4b-f9e7-4df3-9f64-3d35895b8e90";

interface NamedItem {
  name?: string;
  description?: string;
}

interface PackingItem {
  name?: string;
  qty?: string;
  note?: string;
}

export interface TravelResult {
  trip_title?: string;
  trip_summary?: string;
  climate?: string;
  personal_fit?: string;
  palette?: { name?: string; hex?: string }[];
  travel_day?: { title?: string; description?: string; items?: NamedItem[] };
  packing_list?: { category?: string; items?: PackingItem[] }[];
  looks?: {
    title?: string;
    occasion?: string;
    description?: string;
    items?: NamedItem[];
  }[];
  tips?: string[];
  no_image_note?: string;
}

interface Props {
  imageUrl: string | null;
  data: TravelResult | null;
  formParams?: TravelFormParams | null;
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

function ItemList({ items }: { items?: NamedItem[] }) {
  if (!items?.length) return null;
  return (
    <ul className="space-y-1.5">
      {items.map((it, i) => (
        <li key={i} className="text-sm">
          {it.name && <span className="font-medium">{it.name}</span>}
          {it.name && it.description && " — "}
          {it.description && <span className="text-muted-foreground">{it.description}</span>}
        </li>
      ))}
    </ul>
  );
}

function tripRows(fp?: TravelFormParams | null) {
  if (!fp) return [];
  const rows: { label: string; value: string }[] = [];
  const add = (label: string, v?: string | number | string[]) => {
    if (v === undefined || v === null) return;
    const s = Array.isArray(v) ? v.filter(Boolean).join(", ") : `${v}`.trim();
    if (s) rows.push({ label, value: s });
  };
  add("Куда", fp.destination);
  add("Когда", fp.trip_season);
  add("Дней", fp.trip_days);
  add("Откуда", fp.departure_city);
  add("Погода при вылете", fp.departure_weather);
  add("Транспорт", fp.transport);
  add("В дороге", fp.travel_time);
  add("Занятия", fp.activities);
  add("Багаж", fp.luggage);
  add("Пол", fp.gender);
  add("Рост", fp.height ? `${fp.height} см` : undefined);
  add("Типаж по Кибби", fp.kibbe);
  add("Архетипы", fp.archetypes);
  add("Цветотип", fp.colortypes);
  return rows;
}

export default function TravelReport({ imageUrl, data, formParams, onReset, onEdit }: Props) {
  const rows = tripRows(formParams);

  const handleDownload = async () => {
    if (!imageUrl) return;
    try {
      const blob = await fetchAsBlob(imageUrl);
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `travel-capsule-${Date.now()}.png`;
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
            <img src={imageUrl} alt="Три образа капсулы" className="w-full object-contain bg-muted" />
          </CardContent>
        </Card>
      )}

      {data && (
        <Card>
          <CardContent className="p-6 md:p-8 space-y-7">
            <div className="text-center">
              <p className="text-sm uppercase tracking-wide text-muted-foreground">
                Капсула в путешествие
              </p>
              {data.trip_title && <h2 className="text-3xl font-light mt-1">{data.trip_title}</h2>}
              {data.trip_summary && (
                <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">{data.trip_summary}</p>
              )}
            </div>

            {data.climate && (
              <div>
                <SectionTitle icon="CloudSun">Погода и климат</SectionTitle>
                <p className="text-sm text-muted-foreground">{data.climate}</p>
              </div>
            )}

            {data.personal_fit && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
                <SectionTitle icon="UserCheck">Почему эта капсула — ваша</SectionTitle>
                <p className="text-sm text-muted-foreground">{data.personal_fit}</p>
              </div>
            )}

            {!!data.palette?.length && (
              <div>
                <SectionTitle icon="Palette">Палитра капсулы</SectionTitle>
                <div className="flex flex-wrap gap-3">
                  {data.palette.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span
                        className="inline-block h-8 w-8 rounded-full border"
                        style={{ backgroundColor: c.hex || "#ccc" }}
                      />
                      <span className="text-sm font-medium">{c.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.travel_day && (data.travel_day.description || data.travel_day.items?.length) && (
              <div className="rounded-xl border p-5">
                <SectionTitle icon="Plane">{data.travel_day.title || "Образ в дорогу"}</SectionTitle>
                {data.travel_day.description && (
                  <p className="text-sm text-muted-foreground mb-3">{data.travel_day.description}</p>
                )}
                <ItemList items={data.travel_day.items} />
              </div>
            )}

            {!!data.packing_list?.length && (
              <div>
                <SectionTitle icon="Luggage">Что взять с собой</SectionTitle>
                <div className="grid md:grid-cols-2 gap-5">
                  {data.packing_list.map((cat, i) => (
                    <div key={i} className="rounded-xl bg-muted/40 p-4">
                      <p className="font-semibold mb-2">{cat.category}</p>
                      <ul className="space-y-1.5">
                        {(cat.items || []).map((it, j) => (
                          <li key={j} className="flex gap-2 text-sm">
                            <Icon name="Check" size={16} className="mt-0.5 shrink-0 text-primary" />
                            <span>
                              <span className="font-medium">{it.name}</span>
                              {it.qty && <span className="text-primary"> · {it.qty}</span>}
                              {it.note && <span className="text-muted-foreground"> — {it.note}</span>}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!!data.looks?.length && (
              <div>
                <SectionTitle icon="Shirt">Образы</SectionTitle>
                <div className="grid md:grid-cols-3 gap-4">
                  {data.looks.map((look, i) => (
                    <div key={i} className="rounded-xl border p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Образ {i + 1}
                        {look.occasion ? ` · ${look.occasion}` : ""}
                      </p>
                      <p className="font-semibold mt-1 mb-2">{look.title}</p>
                      {look.description && (
                        <p className="text-sm text-muted-foreground mb-3">{look.description}</p>
                      )}
                      <ItemList items={look.items} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!!data.tips?.length && (
              <div>
                <SectionTitle icon="Lightbulb">Советы стилиста</SectionTitle>
                <ul className="space-y-2">
                  {data.tips.map((t, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <Icon name="Check" size={16} className="mt-0.5 shrink-0 text-primary" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {rows.length > 0 && (
        <Card>
          <CardContent className="p-6 md:p-8">
            <SectionTitle icon="SlidersHorizontal">Капсула собрана по параметрам</SectionTitle>
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
          Собрать новую капсулу
        </Button>
      </div>
    </div>
  );
}
