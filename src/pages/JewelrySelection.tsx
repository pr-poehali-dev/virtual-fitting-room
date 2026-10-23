import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { JEWELRY_SELECTION_COST } from "@/config/prices";
import {
  OutfitProfile,
  fetchOutfitProfiles,
  saveOutfitProfile,
} from "@/lib/outfitProfiles";
import { JewelryFormParams } from "@/lib/travelOptions";
import JewelryFields, {
  JewelryState,
  EMPTY_JEWELRY,
} from "@/components/jewelry/JewelryFields";
import PersonFields, {
  PersonState,
  EMPTY_PERSON,
} from "@/components/travel/PersonFields";
import JewelryReport, { JewelryResult } from "@/components/jewelry/JewelryReport";

const START_API =
  "https://functions.poehali.dev/1551f3e9-8029-441b-ac77-2dc9cf164bdc";
const STATUS_API =
  "https://functions.poehali.dev/ce27daee-90c0-4dd7-9369-a6b079895493";

const COST = JEWELRY_SELECTION_COST;
const POLLING_INTERVAL = 8000;
const TIMEOUT_DURATION = 600000;

const toList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x)) : [];
const toStr = (v: unknown): string =>
  v === undefined || v === null ? "" : String(v);

function stageText(seconds: number, hasText: boolean): string {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  const time = min > 0 ? `${min} мин ${sec} сек` : `${sec} сек`;
  if (hasText) return `Рисуем 3 набора… прошло ${time}`;
  if (seconds < 20) return `Изучаем черты и колорит… прошло ${time}`;
  return `Подбираем наборы украшений… прошло ${time}`;
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

export default function JewelrySelection() {
  const { user } = useAuth();
  const { refreshBalance } = useBalance();
  const navigate = useNavigate();
  const { resultRef, scrollToResult } = useScrollToResult<HTMLDivElement>();

  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [jewelry, setJewelry] = useState<JewelryState>(EMPTY_JEWELRY);
  const [person, setPerson] = useState<PersonState>(EMPTY_PERSON);

  const [profiles, setProfiles] = useState<OutfitProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileComment, setProfileComment] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultData, setResultData] = useState<JewelryResult | null>(null);
  const [resultParams, setResultParams] = useState<JewelryFormParams | null>(null);
  const [resultNote, setResultNote] = useState("");

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startedAtRef = useRef<number>(0);

  const stopTimers = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  useEffect(() => stopTimers, []);

  const hasResult = !!(resultUrl || resultData);

  useEffect(() => {
    if (hasResult && !isAnalyzing) scrollToResult();
  }, [hasResult, isAnalyzing, scrollToResult]);

  const loadProfiles = async () => {
    if (!user) return;
    const [own, outfit] = await Promise.all([
      fetchOutfitProfiles("jewelry").catch(() => []),
      fetchOutfitProfiles("outfit").catch(() => []),
    ]);
    setProfiles([...own, ...outfit]);
  };

  useEffect(() => {
    loadProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateImageFile(file);
    if (!validation.isValid) {
      toast.error(validation.error || "Неверный файл");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onloadend = async () => {
      setUploadedImage(await resizeImage(reader.result as string, 1280));
    };
    reader.readAsDataURL(file);
  };

  const buildFormParams = (): JewelryFormParams => {
    const extra = jewelry.customOccasions
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    return {
      occasions: [...jewelry.occasions, ...extra].slice(0, 3),
      metal: jewelry.metal,
      stones: jewelry.stones,
      jewelry_types: jewelry.jewelryTypes,
      ears_pierced: jewelry.earsPierced,
      budget: jewelry.budget,
      jewelry_dislikes: jewelry.dislikes.trim(),
      gender: person.gender,
      kibbe: person.kibbe,
      archetypes: person.archetypes,
      colortypes: person.colortypes,
      hair_color: person.hairColor.trim(),
      eye_color: person.eyeColor.trim(),
      tags: person.tags,
      favorite_colors: person.favoriteColors,
      disliked_colors: person.dislikedColors,
      style_age: person.styleAge.trim(),
      comment: person.comment.trim(),
    };
  };

  const applyProfile = (id: string) => {
    setSelectedProfileId(id);
    const profile = profiles.find((p) => String(p.id) === id);
    if (!profile) return;
    const fp = (profile.form_params || {}) as Record<string, unknown>;
    setPerson({
      gender: toStr(fp.gender),
      height: toStr(fp.height),
      kibbe: toStr(fp.kibbe),
      archetypes: toList(fp.archetypes),
      colortypes: toList(fp.colortypes),
      hairLength: toStr(fp.hair_length),
      hairColor: toStr(fp.hair_color),
      eyeColor: toStr(fp.eye_color),
      tags: toList(fp.tags),
      favoriteColors: toList(fp.favorite_colors),
      dislikedColors: toList(fp.disliked_colors),
      favoriteFabrics: toList(fp.favorite_fabrics),
      dislikedFabrics: toList(fp.disliked_fabrics),
      favoritePatterns: toList(fp.favorite_patterns),
      dislikedPatterns: toList(fp.disliked_patterns),
      skirtLength: toStr(fp.skirt_length),
      styleAge: toStr(fp.style_age),
      comment: toStr(fp.comment),
    });
    if (fp.metal || fp.occasions || fp.jewelry_types) {
      setJewelry({
        occasions: toList(fp.occasions),
        customOccasions: "",
        metal: toStr(fp.metal),
        stones: toList(fp.stones),
        jewelryTypes: toList(fp.jewelry_types),
        earsPierced: toStr(fp.ears_pierced),
        budget: toStr(fp.budget),
        dislikes: toStr(fp.jewelry_dislikes),
      });
    }
    toast.success(`Анкета «${profile.name}» загружена`);
  };

  const openSaveDialog = () => {
    if (!user) {
      toast.error("Войдите в аккаунт, чтобы сохранять анкеты");
      navigate("/login");
      return;
    }
    const parts = [person.gender.toLowerCase(), jewelry.metal, person.kibbe];
    setProfileName("");
    setProfileComment(parts.filter(Boolean).join("; "));
    setSaveDialogOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!profileName.trim()) {
      toast.error("Введите название анкеты");
      return;
    }
    setSavingProfile(true);
    try {
      await saveOutfitProfile({
        name: profileName.trim(),
        comment: profileComment.trim(),
        form_params: buildFormParams() as Record<string, unknown>,
        service_type: "jewelry",
      });
      toast.success("Анкета сохранена");
      setSaveDialogOpen(false);
      loadProfiles();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения");
    } finally {
      setSavingProfile(false);
    }
  };

  const finish = () => {
    stopTimers();
    setIsAnalyzing(false);
    setAnalysisStatus("");
  };

  const pollTaskStatus = async (id: string) => {
    try {
      const token = localStorage.getItem("session_token");
      const response = await fetch(`${STATUS_API}?task_id=${id}`, {
        headers: token ? { "X-Session-Token": token } : {},
        credentials: "include",
      });
      const data = await response.json();
      const seconds = Math.round((Date.now() - startedAtRef.current) / 1000);

      if (data.status === "completed") {
        finish();
        if (!data.cdn_url && !data.result) {
          toast.error("Не удалось получить результат. Попробуйте ещё раз.");
          return;
        }
        setResultUrl(data.cdn_url || null);
        setResultData((data.result as JewelryResult) || null);
        if (data.form_params) setResultParams(data.form_params as JewelryFormParams);
        setResultNote(!data.cdn_url && data.error ? data.error : "");
        toast.success("Ваша подборка украшений готова!");
        refreshBalance();
      } else if (data.status === "failed") {
        finish();
        toast.error(data.error || "Ошибка подбора. Попробуйте ещё раз.");
        refreshBalance();
      } else {
        setAnalysisStatus(stageText(seconds, !!data.result));
      }
    } catch (error) {
      console.error("[JewelrySelection] Polling error:", error);
    }
  };

  const handleAnalyze = async () => {
    if (!user) {
      toast.error("Войдите в аккаунт");
      navigate("/login");
      return;
    }
    if (!uploadedImage) return toast.error("Загрузите своё фото");
    if (!person.gender) return toast.error("Укажите пол");

    setIsAnalyzing(true);
    setAnalysisStatus("Запускаем подбор…");
    setResultUrl(null);
    setResultData(null);
    setResultNote("");
    startedAtRef.current = Date.now();
    scrollToResult();

    try {
      const token = localStorage.getItem("session_token");
      const response = await fetch(START_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "X-Session-Token": token } : {}),
        },
        credentials: "include",
        body: JSON.stringify({
          person_image: uploadedImage,
          service_type: "jewelry",
          form_params: buildFormParams(),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 402) {
          toast.error(`Недостаточно средств. Требуется ${COST} ₽`);
          navigate("/profile/wallet");
          setIsAnalyzing(false);
          return;
        }
        throw new Error(data.error || "Не удалось запустить подбор");
      }

      const taskId = data.task_id;
      pollingRef.current = setInterval(() => pollTaskStatus(taskId), POLLING_INTERVAL);
      timeoutRef.current = setTimeout(() => {
        finish();
        toast.error(
          "Подбор идёт дольше обычного. Результат появится в «Моих образах» в личном кабинете, а если не получится — деньги вернутся автоматически.",
          { duration: 12000 },
        );
      }, TIMEOUT_DURATION);
    } catch (error) {
      finish();
      toast.error(error instanceof Error ? error.message : "Ошибка запуска подбора");
    }
  };

  const handleReset = () => {
    setResultUrl(null);
    setResultData(null);
    setResultParams(null);
    setResultNote("");
    setUploadedImage(null);
    setJewelry(EMPTY_JEWELRY);
    setPerson(EMPTY_PERSON);
    setSelectedProfileId("");
  };

  const handleEdit = () => {
    setResultUrl(null);
    setResultData(null);
    setResultParams(null);
    setResultNote("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <Layout>
      <section className="py-20 px-4">
        <div className="w-full mx-auto max-w-4xl">
          <div className="text-center mb-12 animate-fade-in">
            <h1 className="text-5xl md:text-6xl font-light mb-4">
              Подбор украшений
            </h1>
            <p className="text-muted-foreground text-lg">
              Металлы, камни, формы и масштаб украшений по вашему типажу,
              цветотипу и архетипу — и 3 готовых набора под разные поводы
            </p>
          </div>

          {!hasResult && !isAnalyzing && (
            <LockedFormOverlay cost={COST}>
              <Card>
                <CardContent className="p-6 md:p-8 space-y-8">
                  {user && profiles.length > 0 && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                      <p className="font-medium mb-2 flex items-center gap-2">
                        <Icon name="Bookmark" size={18} className="text-primary" />
                        Заполнить из сохранённой анкеты
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

                  <div>
                    <p className="font-medium mb-3">
                      Ваше фото <span className="text-destructive">*</span>
                    </p>
                    <label
                      htmlFor="jewelry-photo"
                      className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-6 cursor-pointer hover:border-primary/40 transition-colors min-h-[220px]"
                    >
                      {uploadedImage ? (
                        <img
                          src={uploadedImage}
                          alt="Загруженное фото"
                          className="max-h-[300px] rounded-lg object-contain"
                        />
                      ) : (
                        <div className="text-center text-muted-foreground">
                          <Icon name="ImagePlus" size={40} className="mx-auto mb-3" />
                          <p className="text-sm">
                            Портрет, по пояс или в полный рост — лицо должно
                            быть хорошо видно
                          </p>
                          <p className="text-xs mt-1">JPG, PNG, WebP</p>
                        </div>
                      )}
                      <input
                        id="jewelry-photo"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                      />
                    </label>
                  </div>

                  <JewelryFields value={jewelry} onChange={setJewelry} />
                  <PersonFields value={person} onChange={setPerson} compact />

                  <div className="flex flex-col items-center gap-3 pt-2">
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                      <Button
                        size="lg"
                        className="w-full sm:w-auto min-h-11 h-auto py-3 whitespace-normal"
                        onClick={handleAnalyze}
                      >
                        <Icon name="Gem" size={18} className="mr-2 shrink-0" />
                        Подобрать украшения за {COST} ₽
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        className="w-full sm:w-auto min-h-11 h-auto py-3 whitespace-normal"
                        onClick={openSaveDialog}
                      >
                        <Icon name="BookmarkPlus" size={18} className="mr-2 shrink-0" />
                        Сохранить анкету
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      Обязательны фото и пол. Остальное — по желанию: чем
                      больше укажете, тем точнее подборка.
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
                <p className="text-lg font-medium mb-2">
                  {analysisStatus || "Подбираем украшения…"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Обычно 1–3 минуты, в редких случаях — до 10. Не закрывайте
                  страницу. Если что-то пойдёт не так, деньги вернутся
                  автоматически.
                </p>
              </CardContent>
            </Card>
          )}

          {hasResult && !isAnalyzing && (
            <div ref={resultRef} className="space-y-4">
              {resultNote && (
                <Card className="bg-amber-500/10 border-amber-500/40">
                  <CardContent className="p-4 text-sm">{resultNote}</CardContent>
                </Card>
              )}
              <JewelryReport
                imageUrl={resultUrl}
                data={resultData}
                formParams={resultParams}
                onReset={handleReset}
                onEdit={handleEdit}
              />
            </div>
          )}

          <FaqAccordion
            items={[
              {
                question: "Где посмотреть готовые подборки?",
                answer: user ? (
                  <div className="space-y-3">
                    <p>Все подборки сохраняются в личном кабинете.</p>
                    <Button
                      variant="outline"
                      onClick={() => navigate("/profile/history-colorguide")}
                    >
                      <Icon name="Images" size={18} className="mr-2" />
                      Мои образы
                    </Button>
                  </div>
                ) : (
                  <p>Все подборки сохраняются в личном кабинете — войдите в аккаунт.</p>
                ),
              },
              {
                question: "Какое фото загружать?",
                answer:
                  "Подойдёт любое: портрет, по пояс или в полный рост. Главное — чтобы лицо было хорошо видно, при дневном свете и без фильтров. Фото нужно только для разбора и на картинку не попадает.",
              },
              {
                question: "Что будет на картинке?",
                answer:
                  "Предметная раскладка трёх наборов украшений — под каждый выбранный повод.",
              },
              {
                question: "Сколько времени занимает подбор?",
                answer: "Обычно 1–3 минуты, в редких случаях — до 10.",
              },
            ]}
          />
        </div>
      </section>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name="BookmarkPlus" size={20} className="text-primary" />
              Сохранить анкету
            </DialogTitle>
            <DialogDescription>
              Сохраните параметры, чтобы быстро заполнить форму в следующий
              раз.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="jewelry-profile-name">Название анкеты</Label>
              <Input
                id="jewelry-profile-name"
                className="mt-1.5"
                placeholder="Например: Мои украшения"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                maxLength={120}
              />
            </div>
            <div>
              <Label htmlFor="jewelry-profile-comment">Комментарий</Label>
              <Textarea
                id="jewelry-profile-comment"
                className="mt-1.5"
                value={profileComment}
                onChange={(e) => setProfileComment(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)} disabled={savingProfile}>
              Отмена
            </Button>
            <Button onClick={handleSaveProfile} disabled={savingProfile}>
              {savingProfile && <Icon name="Loader2" size={16} className="mr-2 animate-spin" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
