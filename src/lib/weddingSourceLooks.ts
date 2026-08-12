const HISTORY_API =
  "https://functions.poehali.dev/d894b5d6-acf1-4b38-ae86-4c3c1ad3397f";
const DETAIL_API =
  "https://functions.poehali.dev/90841acf-1a1a-4158-a8b6-8ddd65204126";

/** Готовый образ пользователя, который можно использовать как источник стиля
 * или как образ партнёра. Берём свадебные образы и обычные подборы образа. */
export interface SourceLook {
  id: string;
  title: string;
  serviceLabel: string;
  serviceType: string;
  imageUrl: string | null;
  createdAt: string | null;
}

interface HistoryTask {
  id: string;
  status: string;
  service_type?: string | null;
  service_label?: string | null;
  colortype_name?: string | null;
  cdn_url?: string | null;
  created_at?: string | null;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("session_token");
  return token ? { "X-Session-Token": token } : {};
}

/** Список готовых образов (свадебные + подбор образа) для выпадающего списка. */
export async function fetchSourceLooks(): Promise<SourceLook[]> {
  const res = await fetch(
    `${HISTORY_API}?limit=50&offset=0&services=wedding,outfit`,
    { headers: authHeaders(), credentials: "include" },
  );
  if (!res.ok) throw new Error("Не удалось загрузить образы");
  const data = await res.json();
  const tasks = (data.tasks || []) as HistoryTask[];
  return tasks
    .filter((t) => t.status === "completed")
    .map((t) => ({
      id: t.id,
      title: t.colortype_name || t.service_label || "Образ",
      serviceLabel: t.service_label || "",
      serviceType: t.service_type || "",
      imageUrl: t.cdn_url || null,
      createdAt: t.created_at || null,
    }));
}

export interface LookDetail {
  serviceType: string;
  imageUrl: string | null;
  result: Record<string, unknown> | null;
  formParams: Record<string, unknown> | null;
}

/** Полный отчёт по выбранному образу — из него берём стиль или описание наряда. */
export async function fetchLookDetail(id: string): Promise<LookDetail> {
  const res = await fetch(`${DETAIL_API}?task_id=${encodeURIComponent(id)}`, {
    headers: authHeaders(),
    credentials: "include",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Не удалось загрузить образ");
  return {
    serviceType: data.service_type || "",
    imageUrl: data.cdn_url || null,
    result: (data.result as Record<string, unknown>) || null,
    formParams: (data.form_params as Record<string, unknown>) || null,
  };
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function objDesc(v: unknown): string {
  if (!v || typeof v !== "object") return "";
  const o = v as Record<string, unknown>;
  const name = str(o.name);
  const desc = str(o.description);
  if (name && desc) return `${name} — ${desc}`;
  return name || desc;
}

function listDesc(v: unknown, limit = 3): string {
  if (!Array.isArray(v)) return "";
  return v
    .map(objDesc)
    .filter(Boolean)
    .slice(0, limit)
    .join("; ");
}

/** Краткое описание стиля торжества из готового свадебного образа —
 * подставляется в поле «Стиль торжества». */
export function buildStyleFromLook(detail: LookDetail): string {
  const r = detail.result || {};
  const fp = detail.formParams || {};
  const parts: string[] = [];

  const direction = str(r.style_direction);
  if (direction) parts.push(direction);
  else {
    const fpStyle = str(fp.wedding_style);
    if (fpStyle) parts.push(`Стиль торжества: ${fpStyle}`);
    const title = str(r.look_title);
    const identity = str(r.identity);
    if (title || identity)
      parts.push(`Настроение образа: ${[identity, title].filter(Boolean).join(", ")}`);
  }

  const palette = Array.isArray(r.palette)
    ? (r.palette as Record<string, unknown>[])
        .map((c) => str(c.name))
        .filter(Boolean)
        .join(", ")
    : "";
  if (palette) parts.push(`Палитра: ${palette}`);

  return parts.join(" ").slice(0, 1500);
}

/** Описание наряда партнёра из готового образа — подставляется
 * в поле «Образ партнёра». Только одежда, без внешности. */
export function buildPartnerLookText(detail: LookDetail): string {
  const r = detail.result || {};
  const parts: string[] = [];

  const title = str(r.look_title);
  if (title) parts.push(title);

  const outfit = listDesc(r.outfit) || listDesc(r.clothing);
  if (outfit) parts.push(`Наряд: ${outfit}`);

  const shoes = objDesc(r.shoes);
  if (shoes) parts.push(`Обувь: ${shoes}`);

  const headpiece = objDesc(r.headpiece);
  if (headpiece) parts.push(`Головной убор/бутоньерка: ${headpiece}`);

  const accessories = listDesc(r.accessories, 2);
  if (accessories) parts.push(`Аксессуары: ${accessories}`);

  const jewelry = listDesc(r.jewelry, 2);
  if (jewelry) parts.push(`Украшения: ${jewelry}`);

  const palette = Array.isArray(r.palette)
    ? (r.palette as Record<string, unknown>[])
        .map((c) => str(c.name))
        .filter(Boolean)
        .join(", ")
    : "";
  if (palette) parts.push(`Палитра: ${palette}`);

  return parts.join(". ").slice(0, 1500);
}