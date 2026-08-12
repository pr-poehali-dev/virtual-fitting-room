import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";

const IMAGE_PROXY_API =
  "https://functions.poehali.dev/7f105c4b-f9e7-4df3-9f64-3d35895b8e90";

interface NamedItem {
  name?: string;
  description?: string;
}
interface PaletteItem {
  name?: string;
  hex?: string;
  role?: string;
}

export interface WeddingResult {
  identity?: string;
  look_title?: string;
  look_summary?: string;
  style_direction?: string;
  color_analysis?: string;
  body_analysis?: string;
  palette?: PaletteItem[];
  outfit?: NamedItem[];
  shoes?: NamedItem;
  headpiece?: NamedItem;
  accessories?: NamedItem[];
  jewelry?: NamedItem[];
  makeup?: NamedItem;
  hairstyle?: NamedItem;
  partner_harmony?: string;
  comfort_notes?: string[];
  tips?: string[];
}

export interface WeddingFormParams {
  role?: string;
  height?: number | string;
  age?: string | number;
  kibbe?: string;
  archetypes?: string[];
  colortypes?: string[];
  hair_length?: string;
  hair_color?: string;
  eye_color?: string;
  season?: string;
  month?: string;
  venue?: string;
  location?: string;
  day_time?: string;
  style_mode?: string;
  wedding_style?: string;
  wedding_colors?: string;
  partner_look?: string;
  favorite_fabrics?: string[];
  disliked_fabrics?: string[];
  favorite_colors?: string[];
  disliked_colors?: string[];
  tags?: string[];
  dress_silhouette?: string;
  highlight?: string;
  hide?: string;
  restrictions?: string;
  budget?: string;
  comment?: string;
}

interface Props {
  imageUrl: string | null;
  data: WeddingResult | null;
  formParams?: WeddingFormParams | null;
  onReset: () => void;
  onEdit?: () => void;
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
    <h3 className="flex items-center gap-2 text-lg font-semibold text-primary mb-3">
      <Icon name={icon} size={20} />
      {children}
    </h3>
  );
}

function NamedList({ items }: { items?: NamedItem[] }) {
  if (!items || items.length === 0) return null;
  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="text-sm">
          {it.name && <span className="font-medium">{it.name}</span>}
          {it.name && it.description && " — "}
          {it.description && (
            <span className="text-muted-foreground">{it.description}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function NamedBlock({ item, label }: { item?: NamedItem; label: string }) {
  if (!item || (!item.name && !item.description)) return null;
  return (
    <p className="text-sm">
      <span className="font-medium">{item.name || label}</span>
      {item.description && (
        <>
          {item.name ? " — " : ": "}
          <span className="text-muted-foreground">{item.description}</span>
        </>
      )}
    </p>
  );
}

function buildParamRows(
  fp?: WeddingFormParams | null,
): { label: string; value: string }[] {
  if (!fp) return [];
  const rows: { label: string; value: string }[] = [];
  const add = (label: string, value?: string | number | string[]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      const v = value.filter(
        (x) => x !== undefined && x !== null && `${x}`.trim() !== "",
      );
      if (v.length) rows.push({ label, value: v.join(", ") });
    } else {
      const v = `${value}`.trim();
      if (v) rows.push({ label, value: v });
    }
  };
  add("Для кого", fp.role);
  add("Рост", fp.height ? `${fp.height} см` : undefined);
  add("Возраст", fp.age);
  add("Типаж по Кибби", fp.kibbe);
  add("Архетипы", fp.archetypes);
  add("Цветотип", fp.colortypes);
  add("Длина волос", fp.hair_length);
  add("Цвет волос", fp.hair_color);
  add("Цвет глаз", fp.eye_color);
  add("Сезон свадьбы", fp.season);
  add("Месяц", fp.month);
  add("Место проведения", fp.venue);
  add("Город / климат", fp.location);
  add("Время церемонии", fp.day_time);
  add("Стиль торжества", fp.wedding_style);
  add("Гамма свадьбы", fp.wedding_colors);
  add("Образ партнёра", fp.partner_look);
  add("Силуэт платья", fp.dress_silhouette);
  add("Любимые ткани", fp.favorite_fabrics);
  add("Нежелательные ткани", fp.disliked_fabrics);
  add("Любимые цвета", fp.favorite_colors);
  add("Нежелательные цвета", fp.disliked_colors);
  add("Акценты", fp.tags);
  add("Подчеркнуть", fp.highlight);
  add("Скрыть", fp.hide);
  add("Ограничения", fp.restrictions);
  add("Бюджет", fp.budget ? `${fp.budget} ₽` : undefined);
  add("Комментарий", fp.comment);
  return rows;
}

function isGroom(role?: string): boolean {
  const r = (role || "").trim().toLowerCase();
  return r.startsWith("жених") || ["мужской", "мужчина", "groom"].includes(r);
}

function makeupIsEmpty(item?: NamedItem): boolean {
  const text = `${item?.name || ""} ${item?.description || ""}`.toLowerCase();
  if (!text.trim()) return true;
  return (
    text.includes("не требуется") ||
    text.includes("не нужен") ||
    text.includes("без макияжа")
  );
}

export default function WeddingReport({
  imageUrl,
  data,
  formParams,
  onReset,
  onEdit,
}: Props) {
  const paramRows = buildParamRows(formParams);
  const groom = isGroom(formParams?.role);
  const showMakeup =
    !!data &&
    (data.makeup?.name || data.makeup?.description) &&
    !(groom && makeupIsEmpty(data.makeup));

  const handleDownload = async () => {
    if (!imageUrl) return;
    try {
      const blob = await fetchAsBlob(imageUrl);
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `wedding-look-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
      toast.success("Картинка скачана");
    } catch (e) {
      console.error("download error", e);
      toast.error("Ошибка скачивания");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {imageUrl && (
            <img
              src={imageUrl}
              alt="Свадебный образ"
              className="w-full object-contain bg-muted"
            />
          )}
        </CardContent>
      </Card>

      {data && (
        <Card>
          <CardContent className="p-6 md:p-8 space-y-7">
            {(data.look_title || data.identity) && (
              <div className="text-center">
                {data.identity && (
                  <p className="text-sm uppercase tracking-wide text-muted-foreground">
                    {data.identity}
                  </p>
                )}
                {data.look_title && (
                  <h2 className="text-3xl font-light mt-1">
                    {data.look_title}
                  </h2>
                )}
                {data.look_summary && (
                  <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
                    {data.look_summary}
                  </p>
                )}
              </div>
            )}

            {data.style_direction && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <SectionTitle icon="Compass">
                  Стиль торжества и дресс-код
                </SectionTitle>
                <p className="text-sm text-muted-foreground">
                  {data.style_direction}
                </p>
              </div>
            )}

            {data.palette && data.palette.length > 0 && (
              <div>
                <SectionTitle icon="Palette">
                  Палитра образа (60-30-10)
                </SectionTitle>
                <div className="flex flex-wrap gap-3">
                  {data.palette.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span
                        className="inline-block h-8 w-8 rounded-full border"
                        style={{ backgroundColor: c.hex || "#ccc" }}
                      />
                      <span className="text-sm">
                        <span className="font-medium">{c.name}</span>
                        {c.role && (
                          <span className="block text-xs text-muted-foreground">
                            {c.role}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.outfit && data.outfit.length > 0 && (
              <div>
                <SectionTitle icon="Shirt">
                  {groom ? "Костюм и одежда" : "Платье и одежда"}
                </SectionTitle>
                <NamedList items={data.outfit} />
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              {(data.shoes?.name || data.shoes?.description) && (
                <div>
                  <SectionTitle icon="Footprints">Обувь</SectionTitle>
                  <NamedBlock item={data.shoes} label="Обувь" />
                </div>
              )}
              {(data.headpiece?.name || data.headpiece?.description) && (
                <div>
                  <SectionTitle icon="Flower2">
                    {groom ? "Бутоньерка" : "Фата и украшение для головы"}
                  </SectionTitle>
                  <NamedBlock
                    item={data.headpiece}
                    label={groom ? "Бутоньерка" : "Фата"}
                  />
                </div>
              )}
            </div>

            {data.jewelry && data.jewelry.length > 0 && (
              <div>
                <SectionTitle icon="Gem">Украшения</SectionTitle>
                <NamedList items={data.jewelry} />
              </div>
            )}

            {data.accessories && data.accessories.length > 0 && (
              <div>
                <SectionTitle icon="Glasses">Аксессуары</SectionTitle>
                <NamedList items={data.accessories} />
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              {showMakeup && (
                <div>
                  <SectionTitle icon="Sparkles">
                    {groom ? "Груминг" : "Свадебный макияж"}
                  </SectionTitle>
                  <NamedBlock
                    item={data.makeup}
                    label={groom ? "Груминг" : "Макияж"}
                  />
                </div>
              )}
              {(data.hairstyle?.name || data.hairstyle?.description) && (
                <div>
                  <SectionTitle icon="Scissors">Причёска</SectionTitle>
                  <NamedBlock item={data.hairstyle} label="Причёска" />
                </div>
              )}
            </div>

            {(data.color_analysis || data.body_analysis) && (
              <div className="grid md:grid-cols-2 gap-6">
                {data.color_analysis && (
                  <div>
                    <SectionTitle icon="Droplet">
                      Колорит и оттенок наряда
                    </SectionTitle>
                    <p className="text-sm text-muted-foreground">
                      {data.color_analysis}
                    </p>
                  </div>
                )}
                {data.body_analysis && (
                  <div>
                    <SectionTitle icon="PersonStanding">
                      Фигура и силуэт
                    </SectionTitle>
                    <p className="text-sm text-muted-foreground">
                      {data.body_analysis}
                    </p>
                  </div>
                )}
              </div>
            )}

            {data.partner_harmony && (
              <div>
                <SectionTitle icon="Heart">Гармония в паре</SectionTitle>
                <p className="text-sm text-muted-foreground">
                  {data.partner_harmony}
                </p>
              </div>
            )}

            {data.comfort_notes && data.comfort_notes.length > 0 && (
              <div>
                <SectionTitle icon="ShieldCheck">
                  Комфорт в свадебный день
                </SectionTitle>
                <ul className="space-y-2">
                  {data.comfort_notes.map((t, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <Icon
                        name="Info"
                        size={16}
                        className="mt-0.5 shrink-0 text-primary"
                      />
                      <span className="text-muted-foreground">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.tips && data.tips.length > 0 && (
              <div>
                <SectionTitle icon="Lightbulb">
                  Советы свадебного стилиста
                </SectionTitle>
                <ul className="space-y-2">
                  {data.tips.map((t, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <Icon
                        name="Check"
                        size={16}
                        className="mt-0.5 shrink-0 text-primary"
                      />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {paramRows.length > 0 && (
        <Card>
          <CardContent className="p-6 md:p-8">
            <SectionTitle icon="SlidersHorizontal">
              Образ подобран по параметрам
            </SectionTitle>
            <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-2">
              {paramRows.map((r) => (
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
        <Button onClick={handleDownload} variant="outline">
          <Icon name="Download" size={18} className="mr-2" />
          Скачать картинку
        </Button>
        {onEdit && (
          <Button onClick={onEdit} variant="outline">
            <Icon name="Pencil" size={18} className="mr-2" />
            Изменить параметры
          </Button>
        )}
        <Button onClick={onReset}>
          <Icon name="RotateCcw" size={18} className="mr-2" />
          Подобрать новый образ
        </Button>
      </div>
    </div>
  );
}
