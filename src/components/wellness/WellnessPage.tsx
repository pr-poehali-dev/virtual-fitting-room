import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import LockedFormOverlay from "@/components/LockedFormOverlay";
import FaqAccordion from "@/components/FaqAccordion";
import { validateImageFile } from "@/utils/fileValidation";
import { useAuth } from "@/context/AuthContext";
import { useBalance } from "@/context/BalanceContext";
import { useScrollToResult } from "@/hooks/useScrollToResult";
import {
  OutfitProfile,
  fetchOutfitProfiles,
  saveOutfitProfile,
  deleteOutfitProfile,
} from "@/lib/outfitProfiles";
import { FieldDef, FieldValues, PERSON_FIELDS, WEEK_FIELDS } from "@/lib/wellnessOptions";
import FieldsGrid from "./FieldsGrid";
import WellnessReport, { WellnessService } from "./WellnessReport";

const START_API = "https://functions.poehali.dev/1551f3e9-8029-441b-ac77-2dc9cf164bdc";
const STATUS_API = "https://functions.poehali.dev/ce27daee-90c0-4dd7-9369-a6b079895493";
const POLLING_INTERVAL = 6000;
const TIMEOUT_DURATION = 600000;

export interface WellnessConfig {
  service: WellnessService;
  title: string;
  subtitle: string;
  blockTitle: string;
  blockIcon: string;
  fields: FieldDef[];
  buttonLabel: string;
  buttonIcon: string;
  getCost: (values: FieldValues) => number;
  photoHint: string;
  faq: { question: string; answer: string }[];
}

function resizeImage(base64Str: string, maxSize: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        const ratio = width / height;
        if (width > height) {
          width = maxSize;
          height = width / ratio;
        } else {
          height = maxSize;
          width = height * ratio;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.9));
    };
    img.src = base64Str;
  });
}

function cleanValues(values: FieldValues): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(values)) {
    if (Array.isArray(v)) {
      if (v.length) out[k] = v;
    } else if (typeof v === "string" && v.trim()) {
      out[k] = v.trim();
    }
  }
  return out;
}

function toFieldValues(fp: Record<string, unknown>): FieldValues {
  const out: FieldValues = {};
  for (const [k, v] of Object.entries(fp || {})) {
    if (Array.isArray(v)) out[k] = v.map(String);
    else if (v !== undefined && v !== null) out[k] = String(v);
  }
  return out;
}

export default function WellnessPage({ config }: { config: WellnessConfig }) {
  const { user } = useAuth();
  const { refreshBalance } = useBalance();
  const navigate = useNavigate();
  const { resultRef, scrollToResult } = useScrollToResult<HTMLDivElement>();

  const [photo, setPhoto] = useState<string | null>(null);
  const [values, setValues] = useState<FieldValues>({ week_number: "1" });
  const [profiles, setProfiles] = useState<OutfitProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [resultParams, setResultParams] = useState<Record<string, unknown> | null>(null);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startedAtRef = useRef(0);

  const cost = config.getCost(values);
  const allFields = [...config.fields, ...PERSON_FIELDS, ...WEEK_FIELDS];

  const stopTimers = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  useEffect(() => stopTimers, []);

  useEffect(() => {
    if (result && !isAnalyzing) scrollToResult();
  }, [result, isAnalyzing, scrollToResult]);

  const loadProfiles = () => {
    if (!user) return;
    fetchOutfitProfiles(config.service)
      .then(setProfiles)
      .catch(() => {});
  };

  useEffect(() => {
    loadProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const applyProfile = (id: string) => {
    setSelectedProfileId(id);
    const profile = profiles.find((p) => String(p.id) === id);
    if (!profile) return;
    const next = toFieldValues(profile.form_params as unknown as Record<string, unknown>);
    const prevWeek = parseInt(String(next.week_number || "0"), 10);
    next.week_number = String((isNaN(prevWeek) ? 0 : prevWeek) + 1);
    next.last_week_feedback = "";
    setValues(next);
    toast.success(`Анкета «${profile.name}» загружена — это неделя ${next.week_number}`);
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateImageFile(file);
    if (!validation.isValid) {
      toast.error(validation.error || "Неверный файл");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onloadend = async () => setPhoto(await resizeImage(reader.result as string, 1280));
    reader.readAsDataURL(file);
  };

  const saveProfileByName = async (formParams: Record<string, unknown>) => {
    const name = String(formParams.client_name || "").trim();
    if (!name) return;
    try {
      const same = profiles.filter((p) => p.name.trim().toLowerCase() === name.toLowerCase());
      await Promise.all(same.map((p) => deleteOutfitProfile(p.id)));
      await saveOutfitProfile({
        name,
        comment: [formParams.gender, formParams.city].filter(Boolean).join("; "),
        form_params: formParams,
        service_type: config.service,
      });
      loadProfiles();
    } catch (e) {
      console.error("[WellnessPage] profile save error", e);
    }
  };

  const finish = () => {
    stopTimers();
    setIsAnalyzing(false);
    setStatus("");
  };

  const poll = async (taskId: string) => {
    try {
      const token = localStorage.getItem("session_token");
      const res = await fetch(`${STATUS_API}?task_id=${taskId}`, {
        headers: token ? { "X-Session-Token": token } : {},
        credentials: "include",
      });
      const data = await res.json();
      const sec = Math.round((Date.now() - startedAtRef.current) / 1000);
      const time = sec >= 60 ? `${Math.floor(sec / 60)} мин ${sec % 60} сек` : `${sec} сек`;

      if (data.status === "completed") {
        finish();
        if (!data.result) {
          toast.error("Не удалось получить результат. Попробуйте ещё раз.");
          return;
        }
        setResult(data.result);
        setResultParams(data.form_params || null);
        toast.success("Ваш план готов!");
        refreshBalance();
      } else if (data.status === "failed") {
        finish();
        toast.error(data.error || "Ошибка. Попробуйте ещё раз.");
        refreshBalance();
      } else {
        setStatus(sec < 15 ? `Изучаем анкету… прошло ${time}` : `Составляем план… прошло ${time}`);
      }
    } catch (e) {
      console.error("[WellnessPage] polling error", e);
    }
  };

  const handleStart = async () => {
    if (!user) {
      toast.error("Войдите в аккаунт");
      navigate("/login");
      return;
    }
    const missing = allFields.find((f) => {
      if (!f.required) return false;
      const v = values[f.key];
      return Array.isArray(v) ? v.length === 0 : !String(v || "").trim();
    });
    if (missing) {
      toast.error(`Заполните поле «${missing.label}»`);
      return;
    }

    const formParams = cleanValues(values);
    const heightNum = parseInt(String(values.height || ""), 10);

    setIsAnalyzing(true);
    setStatus("Запускаем…");
    setResult(null);
    startedAtRef.current = Date.now();
    scrollToResult();

    try {
      const token = localStorage.getItem("session_token");
      const res = await fetch(START_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "X-Session-Token": token } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          person_image: photo || undefined,
          service_type: config.service,
          height: heightNum >= 100 && heightNum <= 250 ? heightNum : undefined,
          form_params: formParams,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 402) {
          toast.error(`Недостаточно средств. Требуется ${cost} ₽`);
          navigate("/profile/wallet");
          setIsAnalyzing(false);
          return;
        }
        throw new Error(data.error || "Не удалось запустить");
      }
      saveProfileByName(formParams);
      pollingRef.current = setInterval(() => poll(data.task_id), POLLING_INTERVAL);
      timeoutRef.current = setTimeout(() => {
        finish();
        toast.error(
          "Составление идёт дольше обычного. План появится в «Моих образах» в личном кабинете, а если не получится — деньги вернутся автоматически.",
          { duration: 12000 },
        );
      }, TIMEOUT_DURATION);
    } catch (e) {
      finish();
      toast.error(e instanceof Error ? e.message : "Ошибка запуска");
    }
  };

  const handleReset = () => {
    setResult(null);
    setResultParams(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <Layout>
      <section className="py-20 px-4">
        <div className="w-full mx-auto max-w-4xl">
          <div className="text-center mb-12 animate-fade-in">
            <h1 className="text-5xl md:text-6xl font-light mb-4">{config.title}</h1>
            <p className="text-muted-foreground text-lg">{config.subtitle}</p>
            <p className="mt-4 text-xs text-muted-foreground/70 italic">
              Дополнительно при составлении по дням недели использованы материалы системы «7 ангелов» —{" "}
              <a
                href="https://asiabiopharm.com/7angels/vvodnaya-statya/"
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="underline underline-offset-2 hover:text-foreground transition-colors"
              >
                asiabiopharm.com
              </a>
            </p>
          </div>

          {!result && !isAnalyzing && (
            <LockedFormOverlay cost={cost}>
              <Card>
                <CardContent className="p-6 md:p-8 space-y-8">
                  {user && profiles.length > 0 && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                      <p className="font-medium mb-1 flex items-center gap-2">
                        <Icon name="Bookmark" size={18} className="text-primary" />
                        План на следующую неделю
                      </p>
                      <p className="text-xs text-muted-foreground mb-2">
                        Выберите сохранённую анкету — номер недели увеличится сам
                      </p>
                      <Select value={selectedProfileId} onValueChange={applyProfile}>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите анкету" />
                        </SelectTrigger>
                        <SelectContent>
                          {profiles.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              {p.name}
                              {p.comment ? ` — ${p.comment}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <FieldsGrid
                    title={config.blockTitle}
                    icon={config.blockIcon}
                    fields={config.fields}
                    values={values}
                    onChange={setValues}
                    highlighted
                  />
                  <FieldsGrid
                    title="О себе"
                    icon="UserRound"
                    fields={PERSON_FIELDS}
                    values={values}
                    onChange={setValues}
                  />
                  <FieldsGrid
                    title="Неделя"
                    icon="CalendarCheck"
                    fields={WEEK_FIELDS}
                    values={values}
                    onChange={setValues}
                  />

                  <div>
                    <p className="font-medium mb-1">
                      Фото <span className="text-muted-foreground text-xs">(необязательно)</span>
                    </p>
                    <p className="text-xs text-muted-foreground mb-3">{config.photoHint}</p>
                    <label
                      htmlFor={`${config.service}-photo`}
                      className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-5 cursor-pointer hover:border-primary/40 transition-colors min-h-[140px]"
                    >
                      {photo ? (
                        <img src={photo} alt="Фото" className="max-h-[220px] rounded-lg object-contain" />
                      ) : (
                        <div className="text-center text-muted-foreground">
                          <Icon name="ImagePlus" size={32} className="mx-auto mb-2" />
                          <p className="text-sm">Загрузить фото</p>
                        </div>
                      )}
                      <input
                        id={`${config.service}-photo`}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhoto}
                      />
                    </label>
                    {photo && (
                      <Button variant="ghost" size="sm" className="mt-2" onClick={() => setPhoto(null)}>
                        <Icon name="X" size={16} className="mr-1" />
                        Убрать фото
                      </Button>
                    )}
                  </div>

                  <div className="flex flex-col items-center gap-3 pt-2">
                    <Button
                      size="lg"
                      className="w-full sm:w-auto min-h-11 h-auto py-3 whitespace-normal"
                      onClick={handleStart}
                    >
                      <Icon name={config.buttonIcon} size={18} className="mr-2 shrink-0" />
                      {config.buttonLabel} за {cost} ₽
                    </Button>
                    <p className="text-xs text-muted-foreground text-center max-w-lg">
                      Анкета сохранится под вашим именем — на следующей неделе
                      выберите её и получите новый план в один клик. План не
                      заменяет консультацию врача.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </LockedFormOverlay>
          )}

          {isAnalyzing && (
            <Card ref={resultRef}>
              <CardContent className="p-10 text-center">
                <Icon name="Loader2" size={48} className="mx-auto mb-5 animate-spin text-primary" />
                <p className="text-lg font-medium mb-2">{status || "Составляем план…"}</p>
                <p className="text-sm text-muted-foreground">
                  Обычно 1–3 минуты, в редких случаях — до 10. Не закрывайте
                  страницу. Если что-то пойдёт не так, деньги вернутся
                  автоматически.
                </p>
              </CardContent>
            </Card>
          )}

          {result && !isAnalyzing && (
            <div ref={resultRef}>
              <WellnessReport
                service={config.service}
                data={result}
                formParams={resultParams}
                fields={config.fields}
                onReset={handleReset}
                resetLabel="К анкете"
              />
            </div>
          )}

          <FaqAccordion
            items={[
              {
                question: "Где посмотреть прошлые планы?",
                answer: user ? (
                  <div className="space-y-3">
                    <p>Все планы сохраняются в личном кабинете, их можно открыть и скачать в любой момент.</p>
                    <Button variant="outline" onClick={() => navigate("/profile/history-colorguide")}>
                      <Icon name="Images" size={18} className="mr-2" />
                      Мои образы
                    </Button>
                  </div>
                ) : (
                  <p>Все планы сохраняются в личном кабинете — войдите в аккаунт.</p>
                ),
              },
              {
                question: "Как получать план каждую неделю?",
                answer:
                  "Анкета сохраняется под вашим именем. На следующей неделе выберите её вверху формы — номер недели увеличится сам. Напишите, как прошла прошлая неделя, и новый план это учтёт.",
              },
              ...config.faq,
            ]}
          />
        </div>
      </section>
    </Layout>
  );
}