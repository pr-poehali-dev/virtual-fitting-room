import { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";

const loadHtml2Canvas = async () => (await import("html2canvas")).default;

export interface GiftItem {
  name?: string;
  description?: string;
  price?: string;
  why?: string;
  where?: string;
}

export interface GiftResult {
  recipient_summary?: string;
  strategy?: string;
  gifts?: GiftItem[];
  presentation?: string;
  avoid?: string[];
  tips?: string[];
}

export interface GiftFormParams {
  recipient_gender?: string;
  recipient_age?: string | number;
  relation?: string;
  occasion?: string;
  budget_min?: string | number;
  budget_max?: string | number;
  zodiac?: string;
  archetypes?: string[];
  colortypes?: string[];
  interests?: string[];
  gift_formats?: string[];
  season?: string;
  tags?: string[];
  already_gifted?: string;
  restrictions?: string;
  comment?: string;
}

interface Props {
  data: GiftResult | null;
  formParams?: GiftFormParams | null;
  onReset: () => void;
  onEdit?: () => void;
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

function buildParamRows(
  fp?: GiftFormParams | null,
): { label: string; value: string }[] {
  if (!fp) return [];
  const rows: { label: string; value: string }[] = [];
  const add = (label: string, value?: string | number | string[]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      const v = value.filter((x) => `${x}`.trim() !== "");
      if (v.length) rows.push({ label, value: v.join(", ") });
    } else {
      const v = `${value}`.trim();
      if (v) rows.push({ label, value: v });
    }
  };
  add("Пол получателя", fp.recipient_gender);
  add("Возраст", fp.recipient_age);
  add("Кем приходится", fp.relation);
  add("Повод", fp.occasion);
  const budget =
    fp.budget_min && fp.budget_max
      ? `${fp.budget_min} – ${fp.budget_max} ₽`
      : fp.budget_max
        ? `до ${fp.budget_max} ₽`
        : fp.budget_min
          ? `от ${fp.budget_min} ₽`
          : "";
  add("Бюджет", budget);
  add("Знак зодиака", fp.zodiac);
  add("Архетипы", fp.archetypes);
  add("Цветотип", fp.colortypes);
  add("Интересы", fp.interests);
  add("Формат подарка", fp.gift_formats);
  add("Сезон", fp.season);
  add("Настроение", fp.tags);
  add("Уже дарили", fp.already_gifted);
  add("Ограничения", fp.restrictions);
  add("Комментарий", fp.comment);
  return rows;
}

export default function GiftReport({
  data,
  formParams,
  onReset,
  onEdit,
}: Props) {
  const paramRows = buildParamRows(formParams);
  const reportRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!reportRef.current) return;
    setIsDownloading(true);
    try {
      const html2canvas = await loadHtml2Canvas();
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
        imageTimeout: 15000,
      });
      const link = document.createElement("a");
      link.download = `podbor-podarkov-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Отчёт сохранён");
    } catch (e) {
      console.error("[GiftReport] download error", e);
      toast.error("Не удалось скачать отчёт");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" ref={reportRef}>
      {data && (
        <Card>
          <CardContent className="p-6 md:p-8 space-y-7">
            <div className="text-center">
              <h2 className="text-3xl font-light">Подарки для вашего повода</h2>
              {data.recipient_summary && (
                <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
                  {data.recipient_summary}
                </p>
              )}
            </div>

            {data.strategy && (
              <div>
                <SectionTitle icon="Compass">Логика подбора</SectionTitle>
                <p className="text-sm text-muted-foreground">{data.strategy}</p>
              </div>
            )}

            {data.gifts && data.gifts.length > 0 && (
              <div>
                <SectionTitle icon="Gift">Варианты подарков</SectionTitle>
                <div className="space-y-4">
                  {data.gifts.map((g, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-border p-4 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <p className="font-semibold text-base">
                          {i + 1}. {g.name}
                        </p>
                        {g.price && (
                          <span className="rounded-full bg-primary/10 text-primary text-xs px-3 py-1 shrink-0">
                            {g.price}
                          </span>
                        )}
                      </div>
                      {g.description && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {g.description}
                        </p>
                      )}
                      {g.why && (
                        <p className="text-sm mt-2">
                          <span className="font-medium">Почему подойдёт: </span>
                          <span className="text-muted-foreground">{g.why}</span>
                        </p>
                      )}
                      {g.where && (
                        <p className="text-sm mt-1 flex items-start gap-1.5 text-muted-foreground">
                          <Icon
                            name="MapPin"
                            size={15}
                            className="mt-0.5 shrink-0 text-primary"
                          />
                          {g.where}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.presentation && (
              <div>
                <SectionTitle icon="PackageOpen">
                  Как преподнести
                </SectionTitle>
                <p className="text-sm text-muted-foreground">
                  {data.presentation}
                </p>
              </div>
            )}

            {data.avoid && data.avoid.length > 0 && (
              <div>
                <SectionTitle icon="CircleSlash">
                  Чего лучше не дарить
                </SectionTitle>
                <ul className="space-y-2">
                  {data.avoid.map((a, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <Icon
                        name="X"
                        size={16}
                        className="mt-0.5 shrink-0 text-destructive"
                      />
                      <span className="text-muted-foreground">{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.tips && data.tips.length > 0 && (
              <div>
                <SectionTitle icon="Lightbulb">Советы дарителю</SectionTitle>
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
              Подарки подобраны по параметрам
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

      <div
        className="flex flex-col sm:flex-row justify-center gap-3"
        data-html2canvas-ignore="true"
      >
        <Button onClick={handleDownload} disabled={isDownloading}>
          {isDownloading ? (
            <Icon name="Loader2" size={18} className="mr-2 animate-spin" />
          ) : (
            <Icon name="Download" size={18} className="mr-2" />
          )}
          Скачать картинкой
        </Button>
        {onEdit && (
          <Button onClick={onEdit} variant="outline">
            <Icon name="Pencil" size={18} className="mr-2" />
            Изменить параметры
          </Button>
        )}
        <Button onClick={onReset} variant="outline">
          <Icon name="RotateCcw" size={18} className="mr-2" />
          Подобрать другие подарки
        </Button>
      </div>
    </div>
  );
}