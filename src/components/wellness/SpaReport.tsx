import { SectionTitle, TextSection, BulletSection, SafetyNote } from "./ReportParts";

interface Step {
  step?: string;
  product?: string;
  note?: string;
}

export interface SpaResult {
  title?: string;
  summary?: string;
  analysis?: string;
  morning?: Step[];
  evening?: Step[];
  schedule?: {
    period?: string;
    focus?: string;
    rituals?: { name?: string; how?: string }[];
  }[];
  home_recipes?: { name?: string; ingredients?: string; how?: string }[];
  salon?: string[];
  tips?: string[];
  safety?: string;
}

function Routine({ title, icon, steps }: { title: string; icon: string; steps?: Step[] }) {
  if (!steps?.length) return null;
  return (
    <div className="rounded-xl bg-muted/40 p-4">
      <SectionTitle icon={icon}>{title}</SectionTitle>
      <ol className="space-y-1.5 list-decimal pl-5">
        {steps.map((s, i) => (
          <li key={i} className="text-sm">
            <span className="font-medium">{s.step}</span>
            {s.product && <span className="text-primary"> · {s.product}</span>}
            {s.note && <span className="text-muted-foreground"> — {s.note}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function SpaReport({ data }: { data: SpaResult }) {
  return (
    <>
      <TextSection icon="Sparkles" title="Разбор" text={data.analysis} />
      {(!!data.morning?.length || !!data.evening?.length) && (
        <div className="grid md:grid-cols-2 gap-4">
          <Routine title="Утренний уход" icon="Sunrise" steps={data.morning} />
          <Routine title="Вечерний уход" icon="Moon" steps={data.evening} />
        </div>
      )}
      {!!data.schedule?.length && (
        <div>
          <SectionTitle icon="CalendarDays">Программа</SectionTitle>
          <div className="grid md:grid-cols-2 gap-4">
            {data.schedule.map((p, i) => (
              <div key={i} className="rounded-xl border p-4">
                <p className="font-semibold mb-2">
                  {p.period}
                  {p.focus ? ` · ${p.focus}` : ""}
                </p>
                <ul className="space-y-1.5">
                  {(p.rituals || []).map((r, j) => (
                    <li key={j} className="text-sm">
                      <span className="font-medium">{r.name}</span>
                      {r.how && <span className="text-muted-foreground"> — {r.how}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
      {!!data.home_recipes?.length && (
        <div>
          <SectionTitle icon="FlaskConical">Домашние рецепты</SectionTitle>
          <div className="grid md:grid-cols-2 gap-4">
            {data.home_recipes.map((r, i) => (
              <div key={i} className="rounded-xl bg-muted/40 p-4 text-sm">
                <p className="font-semibold mb-1">{r.name}</p>
                {r.ingredients && (
                  <p>
                    <span className="font-medium">Нужно: </span>
                    <span className="text-muted-foreground">{r.ingredients}</span>
                  </p>
                )}
                {r.how && (
                  <p>
                    <span className="font-medium">Как: </span>
                    <span className="text-muted-foreground">{r.how}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <BulletSection icon="Building2" title="В салоне" items={data.salon} />
      <BulletSection icon="Lightbulb" title="Советы" items={data.tips} />
      <SafetyNote text={data.safety} />
    </>
  );
}
