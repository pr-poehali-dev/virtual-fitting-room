import { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import { downloadElementAsPdf } from "@/lib/downloadPdf";
import { FieldDef, PERSON_FIELDS, WEEK_FIELDS } from "@/lib/wellnessOptions";
import { SectionTitle } from "./ReportParts";
import SportReport, { SportResult } from "./SportReport";
import SpaReport, { SpaResult } from "./SpaReport";
import NutritionReport, { NutritionResult } from "./NutritionReport";

export type WellnessService = "sport" | "spa" | "nutrition";

const LABELS: Record<WellnessService, string> = {
  sport: "Спорт и фитнес",
  spa: "SPA-уход",
  nutrition: "План питания",
};

interface Props {
  service: WellnessService;
  data: Record<string, unknown> | null;
  formParams?: Record<string, unknown> | null;
  fields?: FieldDef[];
  onReset: () => void;
  onEdit?: () => void;
  resetLabel?: string;
}

function paramRows(fp: Record<string, unknown> | null | undefined, fields: FieldDef[]) {
  if (!fp) return [];
  const rows: { label: string; value: string }[] = [];
  for (const f of fields) {
    if (f.key === "comment" || f.key === "last_week_feedback") continue;
    const v = fp[f.key];
    const s = Array.isArray(v) ? v.filter(Boolean).join(", ") : v === undefined || v === null ? "" : `${v}`.trim();
    if (s) rows.push({ label: f.label, value: s });
  }
  return rows;
}

export default function WellnessReport({
  service,
  data,
  formParams,
  fields = [],
  onReset,
  onEdit,
  resetLabel = "Новый план",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const rows = paramRows(formParams, [...fields, ...PERSON_FIELDS, ...WEEK_FIELDS]);
  const d = (data || {}) as { title?: string; summary?: string };
  const name = typeof formParams?.client_name === "string" ? formParams.client_name : "";
  const week = formParams?.week_number ? `Неделя ${formParams.week_number}` : "";

  const handleDownload = async () => {
    if (!ref.current) return;
    setDownloading(true);
    try {
      await downloadElementAsPdf(ref.current, `${service}-plan-${Date.now()}.pdf`);
      toast.success("PDF сохранён");
    } catch (e) {
      console.error("[WellnessReport] pdf error", e);
      toast.error("Не удалось скачать PDF");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div ref={ref} className="space-y-6 bg-background">
        {data && (
          <Card>
            <CardContent className="p-6 md:p-8 space-y-7">
              <div className="text-center">
                <p className="text-sm uppercase tracking-wide text-muted-foreground">
                  {[LABELS[service], name, week].filter(Boolean).join(" · ")}
                </p>
                {d.title && <h2 className="text-3xl font-light mt-1">{d.title}</h2>}
                {d.summary && <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">{d.summary}</p>}
              </div>
              {service === "sport" && <SportReport data={data as SportResult} />}
              {service === "spa" && <SpaReport data={data as SpaResult} />}
              {service === "nutrition" && <NutritionReport data={data as NutritionResult} />}
            </CardContent>
          </Card>
        )}

        {rows.length > 0 && (
          <Card>
            <CardContent className="p-6 md:p-8">
              <SectionTitle icon="SlidersHorizontal">План составлен по анкете</SectionTitle>
              <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-2">
                {rows.map((r) => (
                  <div key={r.label} className="flex justify-between gap-3 border-b border-border/60 py-1.5 text-sm">
                    <dt className="text-muted-foreground shrink-0">{r.label}</dt>
                    <dd className="text-right font-medium">{r.value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex flex-col sm:flex-row justify-center gap-3">
        <Button onClick={handleDownload} variant="outline" disabled={downloading || !data}>
          <Icon name={downloading ? "Loader2" : "Download"} size={18} className={`mr-2 ${downloading ? "animate-spin" : ""}`} />
          Скачать PDF
        </Button>
        {onEdit && (
          <Button onClick={onEdit} variant="outline">
            <Icon name="Pencil" size={18} className="mr-2" />
            Изменить анкету
          </Button>
        )}
        <Button onClick={onReset}>
          <Icon name="RotateCcw" size={18} className="mr-2" />
          {resetLabel}
        </Button>
      </div>
    </div>
  );
}
