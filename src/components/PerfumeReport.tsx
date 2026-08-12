import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";

export interface PerfumeItem {
  name?: string;
  brand?: string;
  family?: string;
  top_notes?: string;
  heart_notes?: string;
  base_notes?: string;
  description?: string;
  why?: string;
  longevity?: string;
  sillage?: string;
  occasion?: string;
  price?: string;
}

export interface PerfumeResult {
  profile_summary?: string;
  family_analysis?: string;
  perfumes?: PerfumeItem[];
  layering?: string;
  application?: string;
  avoid_notes?: string[];
  tips?: string[];
}

export interface PerfumeFormParams {
  gender?: string;
  age?: string | number;
  occasion?: string;
  season?: string;
  time_of_day?: string;
  zodiac?: string;
  archetypes?: string[];
  colortypes?: string[];
  kibbe?: string;
  favorite_notes?: string[];
  disliked_notes?: string[];
  longevity?: string;
  sillage?: string;
  perfume_types?: string[];
  loved_perfumes?: string;
  budget_min?: string | number;
  budget_max?: string | number;
  sensitivity?: string;
  tags?: string[];
  comment?: string;
}

interface Props {
  data: PerfumeResult | null;
  formParams?: PerfumeFormParams | null;
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

function NoteRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-muted-foreground shrink-0 w-[92px]">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function buildParamRows(
  fp?: PerfumeFormParams | null,
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
  add("Пол", fp.gender);
  add("Возраст", fp.age);
  add("Повод", fp.occasion);
  add("Сезон", fp.season);
  add("Время суток", fp.time_of_day);
  add("Знак зодиака", fp.zodiac);
  add("Архетипы", fp.archetypes);
  add("Цветотип", fp.colortypes);
  add("Типаж по Кибби", fp.kibbe);
  add("Любимые ноты", fp.favorite_notes);
  add("Нежелательные ноты", fp.disliked_notes);
  add("Стойкость", fp.longevity);
  add("Шлейф", fp.sillage);
  add("Тип парфюмерии", fp.perfume_types);
  add("Нравились раньше", fp.loved_perfumes);
  const budget =
    fp.budget_min && fp.budget_max
      ? `${fp.budget_min} – ${fp.budget_max} ₽`
      : fp.budget_max
        ? `до ${fp.budget_max} ₽`
        : fp.budget_min
          ? `от ${fp.budget_min} ₽`
          : "";
  add("Бюджет", budget);
  add("Чувствительность", fp.sensitivity);
  add("Настроение", fp.tags);
  add("Комментарий", fp.comment);
  return rows;
}

export default function PerfumeReport({
  data,
  formParams,
  onReset,
  onEdit,
}: Props) {
  const paramRows = buildParamRows(formParams);

  return (
    <div className="space-y-6 animate-fade-in">
      {data && (
        <Card>
          <CardContent className="p-6 md:p-8 space-y-7">
            <div className="text-center">
              <h2 className="text-3xl font-light">Ваши ароматы</h2>
              {data.profile_summary && (
                <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
                  {data.profile_summary}
                </p>
              )}
            </div>

            {data.family_analysis && (
              <div>
                <SectionTitle icon="Compass">
                  Подходящие семейства
                </SectionTitle>
                <p className="text-sm text-muted-foreground">
                  {data.family_analysis}
                </p>
              </div>
            )}

            {data.perfumes && data.perfumes.length > 0 && (
              <div>
                <SectionTitle icon="SprayCan">Подобранные ароматы</SectionTitle>
                <div className="space-y-4">
                  {data.perfumes.map((p, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-border p-4 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <p className="font-semibold text-base">
                            {i + 1}. {p.name}
                          </p>
                          {p.brand && (
                            <p className="text-sm text-muted-foreground">
                              {p.brand}
                            </p>
                          )}
                        </div>
                        {p.price && (
                          <span className="rounded-full bg-primary/10 text-primary text-xs px-3 py-1 shrink-0">
                            {p.price}
                          </span>
                        )}
                      </div>

                      {p.family && (
                        <p className="text-xs text-muted-foreground mt-2 uppercase tracking-wide">
                          {p.family}
                        </p>
                      )}

                      {p.description && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {p.description}
                        </p>
                      )}

                      {(p.top_notes || p.heart_notes || p.base_notes) && (
                        <div className="mt-3 space-y-1 rounded-lg bg-muted/50 p-3">
                          <NoteRow label="Верхние" value={p.top_notes} />
                          <NoteRow label="Сердце" value={p.heart_notes} />
                          <NoteRow label="База" value={p.base_notes} />
                        </div>
                      )}

                      {p.why && (
                        <p className="text-sm mt-2">
                          <span className="font-medium">Почему подойдёт: </span>
                          <span className="text-muted-foreground">{p.why}</span>
                        </p>
                      )}

                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                        {p.longevity && <span>Стойкость: {p.longevity}</span>}
                        {p.sillage && <span>Шлейф: {p.sillage}</span>}
                        {p.occasion && <span>Когда: {p.occasion}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.application && (
              <div>
                <SectionTitle icon="Droplet">Как наносить</SectionTitle>
                <p className="text-sm text-muted-foreground">
                  {data.application}
                </p>
              </div>
            )}

            {data.layering && (
              <div>
                <SectionTitle icon="Layers">Слои и сочетания</SectionTitle>
                <p className="text-sm text-muted-foreground">{data.layering}</p>
              </div>
            )}

            {data.avoid_notes && data.avoid_notes.length > 0 && (
              <div>
                <SectionTitle icon="CircleSlash">
                  Ноты, которых стоит избегать
                </SectionTitle>
                <ul className="space-y-2">
                  {data.avoid_notes.map((a, i) => (
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
                <SectionTitle icon="Lightbulb">
                  Советы парфюмерного консультанта
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
              Ароматы подобраны по параметрам
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
        {onEdit && (
          <Button onClick={onEdit} variant="outline">
            <Icon name="Pencil" size={18} className="mr-2" />
            Изменить параметры
          </Button>
        )}
        <Button onClick={onReset}>
          <Icon name="RotateCcw" size={18} className="mr-2" />
          Подобрать другие ароматы
        </Button>
      </div>
    </div>
  );
}
