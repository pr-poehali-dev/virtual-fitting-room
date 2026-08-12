import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Label } from "@/components/ui/label";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import LockedFormOverlay from "@/components/LockedFormOverlay";
import FaqAccordion from "@/components/FaqAccordion";
import { useAuth } from "@/context/AuthContext";
import { PERFUME_SELECTION_COST } from "@/config/prices";
import { useScrollToResult } from "@/hooks/useScrollToResult";
import { useTextSelectionTask } from "@/hooks/useTextSelectionTask";
import PerfumeReport, {
  PerfumeResult,
  PerfumeFormParams,
} from "@/components/PerfumeReport";
import TagPicker from "@/components/selection/TagPicker";
import {
  ARCHETYPES,
  COLORTYPES,
  ZODIAC_SIGNS,
  SEASONS,
  MAX_ARCHETYPES,
  MAX_COLORTYPES,
  mergeCustom,
} from "@/components/selection/selectionUtils";
import {
  OutfitProfile,
  fetchOutfitProfiles,
  saveOutfitProfile,
} from "@/lib/outfitProfiles";

const COST = PERFUME_SELECTION_COST;

const GENDERS = ["Женский", "Мужской"];
const KIBBE_TYPES = [
  "Dramatic (Драматик)",
  "Soft Dramatic (Мягкий драматик)",
  "Flamboyant Natural (Яркий натурал)",
  "Soft Natural (Мягкий натурал)",
  "Dramatic Classic (Драматик классик)",
  "Soft Classic (Мягкий классик)",
  "Flamboyant Gamine (Яркий гамин)",
  "Soft Gamine (Мягкий гамин)",
  "Theatrical Romantic (Театральный романтик)",
  "Romantic (Романтик)",
];
const OCCASIONS = [
  "На каждый день",
  "Офис / работа",
  "Свидание",
  "Вечерний выход",
  "Торжество",
  "Спорт и активность",
  "Отпуск и море",
  "Прогулка",
];
const TIME_OF_DAY = ["Утро", "День", "Вечер", "Ночь"];
const NOTES = [
  "Цитрусовые",
  "Ваниль",
  "Мускус",
  "Древесные",
  "Цветочные",
  "Роза",
  "Жасмин",
  "Специи",
  "Кожа",
  "Морские / акватические",
  "Фруктовые",
  "Табак",
  "Пачули",
  "Сандал",
  "Амбра",
  "Ирис",
  "Лаванда",
  "Бергамот",
  "Кофе",
  "Зелёные / травяные",
];
const LONGEVITY = ["Лёгкая", "Умеренная", "Высокая"];
const SILLAGE = ["Лёгкий, только для себя", "Умеренный", "Плотный, заметный"];
const PERFUME_TYPES = [
  "Туалетная вода",
  "Парфюмерная вода",
  "Духи",
  "Масляные",
  "Нишевая парфюмерия",
];
const SENSITIVITY = [
  "Обычная",
  "Повышенная — тяжёлые ароматы вызывают дискомфорт",
  "Высокая — нужны только деликатные ароматы",
];
const TAGS = [
  "Свежий",
  "Тёплый",
  "Сладкий",
  "Чувственный",
  "Строгий",
  "Романтичный",
  "Дерзкий",
  "Уютный",
  "Элегантный",
  "Необычный",
];

export default function PerfumeSelection() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [occasion, setOccasion] = useState("");
  const [customOccasion, setCustomOccasion] = useState("");
  const [season, setSeason] = useState("");
  const [timeOfDay, setTimeOfDay] = useState("");
  const [zodiac, setZodiac] = useState("");
  const [archetypes, setArchetypes] = useState<string[]>([]);
  const [colortypes, setColortypes] = useState<string[]>([]);
  const [kibbe, setKibbe] = useState("");
  const [favoriteNotes, setFavoriteNotes] = useState<string[]>([]);
  const [customFavoriteNotes, setCustomFavoriteNotes] = useState("");
  const [dislikedNotes, setDislikedNotes] = useState<string[]>([]);
  const [customDislikedNotes, setCustomDislikedNotes] = useState("");
  const [longevity, setLongevity] = useState("");
  const [sillage, setSillage] = useState("");
  const [perfumeTypes, setPerfumeTypes] = useState<string[]>([]);
  const [lovedPerfumes, setLovedPerfumes] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [sensitivity, setSensitivity] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");

  const [profiles, setProfiles] = useState<OutfitProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileComment, setProfileComment] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const { resultRef, scrollToResult } = useScrollToResult<HTMLDivElement>();
  const { isAnalyzing, statusText, result, resultParams, start, reset } =
    useTextSelectionTask<PerfumeResult>("perfume", COST, "Ароматы подобраны!");

  useEffect(() => {
    if (result && !isAnalyzing) scrollToResult();
  }, [result, isAnalyzing, scrollToResult]);

  const loadProfiles = () => {
    if (!user) return;
    fetchOutfitProfiles("perfume")
      .then(setProfiles)
      .catch(() => {});
  };

  useEffect(() => {
    loadProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const toggleMulti = (
    value: string,
    list: string[],
    setList: (v: string[]) => void,
    max: number,
  ) => {
    if (list.includes(value)) {
      setList(list.filter((v) => v !== value));
    } else {
      if (list.length >= max) {
        toast.error(`Можно выбрать не более ${max}`);
        return;
      }
      setList([...list, value]);
    }
  };

  const toggleTag = (
    value: string,
    setList: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    setList((prev) =>
      prev.includes(value) ? prev.filter((x) => x !== value) : [...prev, value],
    );
  };

  const buildFormParams = (): PerfumeFormParams => ({
    gender,
    age: age.trim(),
    occasion: customOccasion.trim() || occasion,
    season,
    time_of_day: timeOfDay,
    zodiac,
    archetypes,
    colortypes,
    kibbe,
    favorite_notes: mergeCustom(favoriteNotes, customFavoriteNotes),
    disliked_notes: mergeCustom(dislikedNotes, customDislikedNotes),
    longevity,
    sillage,
    perfume_types: perfumeTypes,
    loved_perfumes: lovedPerfumes.trim(),
    budget_min: budgetMin.trim(),
    budget_max: budgetMax.trim(),
    sensitivity,
    tags,
    comment: comment.trim(),
  });

  const applyProfile = (id: string) => {
    setSelectedProfileId(id);
    if (!id) return;
    const profile = profiles.find((p) => String(p.id) === id);
    if (!profile) return;
    const fp = (profile.form_params || {}) as PerfumeFormParams;
    setGender(fp.gender || "");
    setAge(fp.age ? String(fp.age) : "");
    setOccasion(fp.occasion || "");
    setCustomOccasion("");
    setSeason(fp.season || "");
    setTimeOfDay(fp.time_of_day || "");
    setZodiac(fp.zodiac || "");
    setArchetypes(fp.archetypes || []);
    setColortypes(fp.colortypes || []);
    setKibbe(fp.kibbe || "");
    setFavoriteNotes(fp.favorite_notes || []);
    setCustomFavoriteNotes("");
    setDislikedNotes(fp.disliked_notes || []);
    setCustomDislikedNotes("");
    setLongevity(fp.longevity || "");
    setSillage(fp.sillage || "");
    setPerfumeTypes(fp.perfume_types || []);
    setLovedPerfumes(fp.loved_perfumes || "");
    setBudgetMin(fp.budget_min ? String(fp.budget_min) : "");
    setBudgetMax(fp.budget_max ? String(fp.budget_max) : "");
    setSensitivity(fp.sensitivity || "");
    setTags(fp.tags || []);
    setComment(fp.comment || "");
    toast.success(`Анкета «${profile.name}» загружена`);
  };

  const buildAutoComment = (): string => {
    const parts: string[] = [];
    if (gender) parts.push(gender.toLowerCase());
    const occ = customOccasion.trim() || occasion;
    if (occ) parts.push(`повод: ${occ}`);
    if (season) parts.push(`сезон: ${season}`);
    return parts.join("; ");
  };

  const openSaveDialog = () => {
    if (!user) {
      toast.error("Войдите в аккаунт, чтобы сохранять анкеты");
      navigate("/login");
      return;
    }
    setProfileName("");
    setProfileComment(buildAutoComment());
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
        form_params: buildFormParams(),
        service_type: "perfume",
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

  const handleAnalyze = () => {
    if (!gender) {
      toast.error("Укажите пол");
      return;
    }
    const min = parseInt(budgetMin, 10);
    const max = parseInt(budgetMax, 10);
    if (!isNaN(min) && !isNaN(max) && min > max) {
      toast.error("Бюджет «от» больше, чем «до»");
      return;
    }
    const overlap = favoriteNotes.filter((n) => dislikedNotes.includes(n));
    if (overlap.length) {
      toast.error(`Нота «${overlap[0]}» указана и как любимая, и как нежелательная`);
      return;
    }
    scrollToResult();
    start(buildFormParams() as unknown as Record<string, unknown>);
  };

  const handleReset = () => {
    reset();
    setGender("");
    setAge("");
    setOccasion("");
    setCustomOccasion("");
    setSeason("");
    setTimeOfDay("");
    setZodiac("");
    setArchetypes([]);
    setColortypes([]);
    setKibbe("");
    setFavoriteNotes([]);
    setCustomFavoriteNotes("");
    setDislikedNotes([]);
    setCustomDislikedNotes("");
    setLongevity("");
    setSillage("");
    setPerfumeTypes([]);
    setLovedPerfumes("");
    setBudgetMin("");
    setBudgetMax("");
    setSensitivity("");
    setTags([]);
    setComment("");
  };

  const handleEdit = () => {
    reset();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <Layout>
      <section className="py-20 px-4">
        <div className="w-full mx-auto max-w-4xl">
          <div className="text-center mb-12 animate-fade-in">
            <h2 className="text-5xl md:text-6xl font-light mb-4">
              Подбор ароматов
            </h2>
            <p className="text-muted-foreground text-lg">
              Пять ароматов под ваш характер, повод и любимые ноты — с разбором
              пирамиды, стойкости и советами по нанесению
            </p>
          </div>

          {!result && !isAnalyzing && (
            <div className="relative">
              <LockedFormOverlay cost={COST} actionLabel="подбора ароматов">
                <Card>
                  <CardContent className="p-6 md:p-8 space-y-8">
                    {user && profiles.length > 0 && (
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                        <p className="font-medium mb-2 flex items-center gap-2">
                          <Icon
                            name="Bookmark"
                            size={18}
                            className="text-primary"
                          />
                          Быстрое заполнение из сохранённой анкеты
                        </p>
                        <Select
                          value={selectedProfileId}
                          onValueChange={applyProfile}
                        >
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

                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <p className="font-medium mb-2">
                          Пол <span className="text-destructive">*</span>
                        </p>
                        <Select value={gender} onValueChange={setGender}>
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите пол" />
                          </SelectTrigger>
                          <SelectContent>
                            {GENDERS.map((g) => (
                              <SelectItem key={g} value={g}>
                                {g}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <p className="font-medium mb-2">
                          Возраст{" "}
                          <span className="text-muted-foreground text-xs">
                            (необязательно)
                          </span>
                        </p>
                        <Input
                          type="number"
                          min={1}
                          max={120}
                          placeholder="Например, 30"
                          value={age}
                          onChange={(e) => setAge(e.target.value)}
                        />
                      </div>
                      <div>
                        <p className="font-medium mb-2">
                          Типаж по Кибби{" "}
                          <span className="text-muted-foreground text-xs">
                            (необязательно)
                          </span>
                        </p>
                        <Select value={kibbe} onValueChange={setKibbe}>
                          <SelectTrigger>
                            <SelectValue placeholder="Не выбрано" />
                          </SelectTrigger>
                          <SelectContent>
                            {KIBBE_TYPES.map((k) => (
                              <SelectItem key={k} value={k}>
                                {k}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <p className="font-medium mb-2">Повод / когда носить</p>
                        <Select value={occasion} onValueChange={setOccasion}>
                          <SelectTrigger>
                            <SelectValue placeholder="Не выбрано" />
                          </SelectTrigger>
                          <SelectContent>
                            {OCCASIONS.map((o) => (
                              <SelectItem key={o} value={o}>
                                {o}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          className="mt-2"
                          placeholder="Или свой вариант"
                          value={customOccasion}
                          onChange={(e) => setCustomOccasion(e.target.value)}
                        />
                      </div>
                      <div>
                        <p className="font-medium mb-2">Сезон</p>
                        <Select value={season} onValueChange={setSeason}>
                          <SelectTrigger>
                            <SelectValue placeholder="Не выбрано" />
                          </SelectTrigger>
                          <SelectContent>
                            {SEASONS.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <p className="font-medium mb-2">Время суток</p>
                        <Select value={timeOfDay} onValueChange={setTimeOfDay}>
                          <SelectTrigger>
                            <SelectValue placeholder="Не выбрано" />
                          </SelectTrigger>
                          <SelectContent>
                            {TIME_OF_DAY.map((t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
                      <TagPicker
                        title="Ноты, которые нравятся"
                        options={NOTES}
                        selected={favoriteNotes}
                        onToggle={(v) => toggleTag(v, setFavoriteNotes)}
                        custom={customFavoriteNotes}
                        onCustomChange={setCustomFavoriteNotes}
                      />
                      <TagPicker
                        title="Ноты, которые не нравятся"
                        hint="Эти ноты будут строго исключены из подбора"
                        options={NOTES}
                        selected={dislikedNotes}
                        onToggle={(v) => toggleTag(v, setDislikedNotes)}
                        custom={customDislikedNotes}
                        onCustomChange={setCustomDislikedNotes}
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="font-medium mb-2">Желаемая стойкость</p>
                        <Select value={longevity} onValueChange={setLongevity}>
                          <SelectTrigger>
                            <SelectValue placeholder="Не выбрано" />
                          </SelectTrigger>
                          <SelectContent>
                            {LONGEVITY.map((l) => (
                              <SelectItem key={l} value={l}>
                                {l}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <p className="font-medium mb-2">Желаемый шлейф</p>
                        <Select value={sillage} onValueChange={setSillage}>
                          <SelectTrigger>
                            <SelectValue placeholder="Не выбрано" />
                          </SelectTrigger>
                          <SelectContent>
                            {SILLAGE.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <TagPicker
                      title="Тип парфюмерии"
                      options={PERFUME_TYPES}
                      selected={perfumeTypes}
                      onToggle={(v) => toggleTag(v, setPerfumeTypes)}
                    />

                    <div>
                      <p className="font-medium mb-2">
                        Архетип(ы) по Карлу Юнгу{" "}
                        <span className="text-muted-foreground text-xs">
                          (до 4, необязательно)
                        </span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {ARCHETYPES.map((a) => (
                          <button
                            key={a}
                            type="button"
                            onClick={() =>
                              toggleMulti(
                                a,
                                archetypes,
                                setArchetypes,
                                MAX_ARCHETYPES,
                              )
                            }
                            className={`rounded-full border px-3 py-1.5 text-sm transition-all ${
                              archetypes.includes(a)
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border hover:border-primary/40"
                            }`}
                          >
                            {a}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="font-medium mb-2">
                        Цветотип внешности{" "}
                        <span className="text-muted-foreground text-xs">
                          (до 2, необязательно)
                        </span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {COLORTYPES.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() =>
                              toggleMulti(
                                c,
                                colortypes,
                                setColortypes,
                                MAX_COLORTYPES,
                              )
                            }
                            className={`rounded-full border px-3 py-1.5 text-sm transition-all ${
                              colortypes.includes(c)
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border hover:border-primary/40"
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="font-medium mb-2">
                          Знак зодиака{" "}
                          <span className="text-muted-foreground text-xs">
                            (необязательно)
                          </span>
                        </p>
                        <Select value={zodiac} onValueChange={setZodiac}>
                          <SelectTrigger>
                            <SelectValue placeholder="Не выбрано" />
                          </SelectTrigger>
                          <SelectContent>
                            {ZODIAC_SIGNS.map((z) => (
                              <SelectItem key={z} value={z}>
                                {z}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <p className="font-medium mb-2">
                          Бюджет, ₽{" "}
                          <span className="text-muted-foreground text-xs">
                            (необязательно)
                          </span>
                        </p>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            placeholder="от"
                            value={budgetMin}
                            onChange={(e) => setBudgetMin(e.target.value)}
                          />
                          <span className="text-muted-foreground">—</span>
                          <Input
                            type="number"
                            min={0}
                            placeholder="до"
                            value={budgetMax}
                            onChange={(e) => setBudgetMax(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <TagPicker
                      title="Желаемое настроение аромата"
                      options={TAGS}
                      selected={tags}
                      onToggle={(v) => toggleTag(v, setTags)}
                    />

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="font-medium mb-2">
                          Ароматы, которые нравились раньше{" "}
                          <span className="text-muted-foreground text-xs">
                            (необязательно)
                          </span>
                        </p>
                        <Textarea
                          placeholder="Названия ароматов, которые вам нравились..."
                          value={lovedPerfumes}
                          onChange={(e) => setLovedPerfumes(e.target.value)}
                          rows={3}
                        />
                      </div>
                      <div>
                        <p className="font-medium mb-2">
                          Чувствительность к запахам{" "}
                          <span className="text-muted-foreground text-xs">
                            (необязательно)
                          </span>
                        </p>
                        <Select
                          value={sensitivity}
                          onValueChange={setSensitivity}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Не выбрано" />
                          </SelectTrigger>
                          <SelectContent>
                            {SENSITIVITY.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <p className="font-medium mb-2">
                        Комментарий{" "}
                        <span className="text-muted-foreground text-xs">
                          (необязательно)
                        </span>
                      </p>
                      <Textarea
                        placeholder="Особые пожелания: что хотите чувствовать, какое впечатление производить..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={3}
                      />
                    </div>

                    <div className="flex flex-col items-center gap-3 pt-2">
                      <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                        <Button
                          size="lg"
                          className="w-full sm:w-auto max-w-full min-h-11 h-auto py-3 whitespace-normal text-center leading-snug"
                          onClick={handleAnalyze}
                        >
                          <Icon
                            name="SprayCan"
                            size={18}
                            className="mr-2 shrink-0"
                          />
                          <span className="min-w-0">
                            Подобрать ароматы за {COST} ₽
                          </span>
                        </Button>
                        <Button
                          size="lg"
                          variant="outline"
                          className="w-full sm:w-auto max-w-full min-h-11 h-auto py-3 whitespace-normal text-center leading-snug"
                          onClick={openSaveDialog}
                        >
                          <Icon
                            name="BookmarkPlus"
                            size={18}
                            className="mr-2 shrink-0"
                          />
                          <span className="min-w-0">Сохранить анкету</span>
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground text-center">
                        Обязателен только пол. Чем больше укажете — тем точнее
                        ароматы. Фото не нужно.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </LockedFormOverlay>
            </div>
          )}

          {isAnalyzing && (
            <Card ref={resultRef}>
              <CardContent className="p-10 text-center">
                <Icon
                  name="Loader2"
                  size={48}
                  className="mx-auto mb-5 animate-spin text-primary"
                />
                <p className="text-lg font-medium mb-2">
                  {statusText || "Подбираем ароматы..."}
                </p>
                <p className="text-sm text-muted-foreground">
                  Обычно занимает меньше минуты. Не закрывайте страницу.
                </p>
              </CardContent>
            </Card>
          )}

          {result && !isAnalyzing && (
            <div ref={resultRef}>
              <PerfumeReport
                data={result}
                formParams={resultParams as PerfumeFormParams | null}
                onReset={handleReset}
                onEdit={handleEdit}
              />
            </div>
          )}

          <FaqAccordion
            items={[
              {
                question: "Где посмотреть все подборки?",
                answer: user ? (
                  <div className="space-y-3">
                    <p>
                      Все подборки сохраняются в личном кабинете — вы можете
                      вернуться к ним в любой момент.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => navigate("/profile/history-colorguide")}
                    >
                      <Icon name="Images" size={18} className="mr-2" />
                      Мои подборки
                    </Button>
                  </div>
                ) : (
                  <p>
                    Все подборки сохраняются в личном кабинете. Войдите в
                    аккаунт, чтобы они были доступны вам в любой момент.
                  </p>
                ),
              },
              {
                question: "Нужно ли фото?",
                answer:
                  "Нет, фото не требуется. Ароматы подбираются по анкете: характер, повод, любимые ноты и бюджет.",
              },
              {
                question: "Можно ли купить эти ароматы?",
                answer:
                  "Мы не продаём парфюмерию. Вы получаете названия реальных ароматов с разбором нот — их можно протестировать в магазине перед покупкой.",
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
              Сохраните заполненные параметры, чтобы быстро подобрать аромат в
              следующий раз.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="perfume-profile-name">Название анкеты</Label>
              <Input
                id="perfume-profile-name"
                className="mt-1.5"
                placeholder="Например: Ароматы на каждый день"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                maxLength={120}
              />
            </div>
            <div>
              <Label htmlFor="perfume-profile-comment">Комментарий</Label>
              <Textarea
                id="perfume-profile-comment"
                className="mt-1.5"
                placeholder="Например: лёгкие свежие ароматы для офиса"
                value={profileComment}
                onChange={(e) => setProfileComment(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Заполнен автоматически — можно отредактировать.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSaveDialogOpen(false)}
              disabled={savingProfile}
            >
              Отмена
            </Button>
            <Button onClick={handleSaveProfile} disabled={savingProfile}>
              {savingProfile && (
                <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
              )}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}