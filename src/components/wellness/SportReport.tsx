import { SectionTitle, TextSection, BulletSection, SafetyNote } from "./ReportParts";
import Icon from "@/components/ui/icon";

export interface SportResult {
  title?: string;
  summary?: string;
  analysis?: string;
  warmup?: string;
  days?: {
    day?: string;
    focus?: string;
    duration?: string;
    exercises?: { name?: string; dose?: string; note?: string }[];
    alternative?: string;
  }[];
  cooldown?: string;
  progress?: string;
  tips?: string[];
  safety?: string;
}

export default function SportReport({ data }: { data: SportResult }) {
  return (
    <>
      <TextSection icon="Activity" title="Разбор" text={data.analysis} />
      <TextSection icon="Flame" title="Разминка" text={data.warmup} />
      {!!data.days?.length && (
        <div>
          <SectionTitle icon="CalendarDays">План на неделю</SectionTitle>
          <div className="grid md:grid-cols-2 gap-4">
            {data.days.map((d, i) => (
              <div key={i} className="rounded-xl border p-4">
                <div className="flex items-baseline justify-between gap-2 mb-2">
                  <p className="font-semibold">
                    {d.day}
                    {d.focus ? ` · ${d.focus}` : ""}
                  </p>
                  {d.duration && <span className="text-xs text-muted-foreground shrink-0">{d.duration}</span>}
                </div>
                <ul className="space-y-1.5 mb-3">
                  {(d.exercises || []).map((e, j) => (
                    <li key={j} className="text-sm">
                      <span className="font-medium">{e.name}</span>
                      {e.dose && <span className="text-primary"> · {e.dose}</span>}
                      {e.note && <span className="text-muted-foreground"> — {e.note}</span>}
                    </li>
                  ))}
                </ul>
                {d.alternative && (
                  <p className="text-sm rounded-lg bg-muted/50 p-2.5 flex gap-2">
                    <Icon name="Repeat" size={16} className="shrink-0 mt-0.5 text-primary" />
                    <span>
                      <span className="font-medium">Замена: </span>
                      <span className="text-muted-foreground">{d.alternative}</span>
                    </span>
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <TextSection icon="Wind" title="Заминка и растяжка" text={data.cooldown} />
      <TextSection icon="TrendingUp" title="На следующей неделе" text={data.progress} />
      <BulletSection icon="Lightbulb" title="Советы" items={data.tips} />
      <SafetyNote text={data.safety} />
    </>
  );
}
