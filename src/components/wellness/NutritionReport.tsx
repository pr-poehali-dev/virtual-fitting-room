import Icon from "@/components/ui/icon";
import { SectionTitle, TextSection, BulletSection, SafetyNote } from "./ReportParts";

export interface NutritionResult {
  title?: string;
  summary?: string;
  analysis?: string;
  daily_target?: string;
  days?: {
    day?: string;
    meals?: { meal?: string; dish?: string; recipe?: string; time?: string }[];
  }[];
  shopping_list?: { category?: string; items?: { name?: string; qty?: string }[] }[];
  substitutes?: { product?: string; replace?: string }[];
  prep?: string;
  water?: string;
  tips?: string[];
  safety?: string;
}

export default function NutritionReport({ data }: { data: NutritionResult }) {
  return (
    <>
      <TextSection icon="Salad" title="Разбор" text={data.analysis} />
      {data.daily_target && (
        <p className="rounded-xl bg-primary/5 border border-primary/20 p-4 text-sm">
          <span className="font-medium">Ориентир на день: </span>
          {data.daily_target}
        </p>
      )}
      {!!data.days?.length && (
        <div>
          <SectionTitle icon="CalendarDays">Меню на неделю</SectionTitle>
          <div className="grid md:grid-cols-2 gap-4">
            {data.days.map((d, i) => (
              <div key={i} className="rounded-xl border p-4">
                <p className="font-semibold mb-2">{d.day}</p>
                <ul className="space-y-2">
                  {(d.meals || []).map((m, j) => (
                    <li key={j} className="text-sm">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">
                        {m.meal}
                        {m.time ? ` · ${m.time}` : ""}
                      </span>
                      <p className="font-medium">{m.dish}</p>
                      {m.recipe && <p className="text-muted-foreground">{m.recipe}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
      {!!data.shopping_list?.length && (
        <div>
          <SectionTitle icon="ShoppingCart">Список покупок</SectionTitle>
          <div className="grid md:grid-cols-3 gap-4">
            {data.shopping_list.map((c, i) => (
              <div key={i} className="rounded-xl bg-muted/40 p-4">
                <p className="font-semibold mb-2">{c.category}</p>
                <ul className="space-y-1">
                  {(c.items || []).map((it, j) => (
                    <li key={j} className="flex gap-2 text-sm">
                      <Icon name="Square" size={14} className="mt-1 shrink-0 text-muted-foreground" />
                      <span>
                        {it.name}
                        {it.qty && <span className="text-muted-foreground"> · {it.qty}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
      {!!data.substitutes?.length && (
        <div>
          <SectionTitle icon="Repeat">Если продукта нет в продаже</SectionTitle>
          <ul className="space-y-1.5">
            {data.substitutes.map((s, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium">{s.product}</span>
                <span className="text-muted-foreground"> → {s.replace}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <TextSection icon="Timer" title="Заготовки" text={data.prep} />
      <TextSection icon="GlassWater" title="Вода" text={data.water} />
      <BulletSection icon="Lightbulb" title="Советы" items={data.tips} />
      <SafetyNote text={data.safety} />
    </>
  );
}
