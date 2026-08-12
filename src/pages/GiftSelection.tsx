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
import { GIFT_SELECTION_COST } from "@/config/prices";
import { useScrollToResult } from "@/hooks/useScrollToResult";
import { useTextSelectionTask } from "@/hooks/useTextSelectionTask";
import GiftReport, { GiftResult, GiftFormParams } from "@/components/GiftReport";
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

const COST = GIFT_SELECTION_COST;

const GENDERS = ["Женский", "Мужской"];
const RELATIONS = [
  "Партнёр / супруг(а)",
  "Мама",
  "Папа",
  "Бабушка / дедушка",
  "Сестра / брат",
  "Ребёнок",
  "Друг / подруга",
  "Коллега",
  "Руководитель",
  "Знакомый",
];
const OCCASIONS = [
  "День рождения",
  "Новый год",
  "8 марта",
  "23 февраля",
  "Свадьба",
  "Годовщина",
  "Новоселье",
  "Рождение ребёнка",
  "Выпускной",
  "Просто так, без повода",
];
const INTERESTS = [
  "Спорт и фитнес",
  "Путешествия",
  "Кулинария",
  "Чтение",
  "Музыка",
  "Кино и сериалы",
  "Искусство и живопись",
  "Фотография",
  "Рукоделие",
  "Садоводство",
  "Автомобили",
  "Технологии и гаджеты",
  "Настольные игры",
  "Компьютерные игры",
  "Мода и стиль",
  "Красота и уход",
  "Йога и медитация",
  "Животные",
  "Рыбалка и охота",
  "Туризм и походы",
];
const GIFT_FORMATS = [
  "Вещь",
  "Впечатление",
  "Съедобное",
  "Украшение",
  "Для дома и уюта",
  "Бьюти и уход",
  "Книга",
  "Хендмейд",
  "Техника и гаджеты",
  "Сертификат",
];
const TAGS = [
  "Практичный",
  "Романтичный",
  "Вау-эффект",
  "С юмором",
  "Статусный",
  "Уютный",
  "Оригинальный",
  "Трогательный",
  "Полезный каждый день",
  "Памятный",
];

export default function GiftSelection() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [recipientGender, setRecipientGender] = useState("");
  const [recipientAge, setRecipientAge] = useState("");
  const [relation, setRelation] = useState("");
  const [occasion, setOccasion] = useState("");
  const [customOccasion, setCustomOccasion] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [zodiac, setZodiac] = useState("");
  const [archetypes, setArchetypes] = useState<string[]>([]);
  const [colortypes, setColortypes] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [customInterests, setCustomInterests] = useState("");
  const [giftFormats, setGiftFormats] = useState<string[]>([]);
  const [season, setSeason] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [alreadyGifted, setAlreadyGifted] = useState("");
  const [restrictions, setRestrictions] = useState("");
  const [comment, setComment] = useState("");

  const [profiles, setProfiles] = useState<OutfitProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileComment, setProfileComment] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const { resultRef, scrollToResult } = useScrollToResult<HTMLDivElement>();
  const { isAnalyzing, statusText, result, resultParams, start, reset } =
    useTextSelectionTask<GiftResult>("gift", COST, "Подарки подобраны!");

  useEffect(() => {
    if (result && !isAnalyzing) scrollToResult();
  }, [result, isAnalyzing, scrollToResult]);

  const loadProfiles = () => {
    if (!user) return;
    fetchOutfitProfiles("gift")
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

  const buildFormParams = (): GiftFormParams => ({
    recipient_gender: recipientGender,
    recipient_age: recipientAge.trim(),
    relation,
    occasion: customOccasion.trim() || occasion,
    budget_min: budgetMin.trim(),
    budget_max: budgetMax.trim(),
    zodiac,
    archetypes,
    colortypes,
    interests: mergeCustom(interests, customInterests),
    gift_formats: giftFormats,
    season,
    tags,
    already_gifted: alreadyGifted.trim(),
    restrictions: restrictions.trim(),
    comment: comment.trim(),
  });

  const applyProfile = (id: string) => {
    setSelectedProfileId(id);
    if (!id) return;
    const profile = profiles.find((p) => String(p.id) === id);
    if (!profile) return;
    const fp = (profile.form_params || {}) as GiftFormParams;
    setRecipientGender(fp.recipient_gender || "");
    setRecipientAge(fp.recipient_age ? String(fp.recipient_age) : "");
    setRelation(fp.relation || "");
    setOccasion(fp.occasion || "");
    setCustomOccasion("");
    setBudgetMin(fp.budget_min ? String(fp.budget_min) : "");
    setBudgetMax(fp.budget_max ? String(fp.budget_max) : "");
    setZodiac(fp.zodiac || "");
    setArchetypes(fp.archetypes || []);
    setColortypes(fp.colortypes || []);
    setInterests(fp.interests || []);
    setCustomInterests("");
    setGiftFormats(fp.gift_formats || []);
    setSeason(fp.season || "");
    setTags(fp.tags || []);
    setAlreadyGifted(fp.already_gifted || "");
    setRestrictions(fp.restrictions || "");
    setComment(fp.comment || "");
    toast.success(`Анкета «${profile.name}» загружена`);
  };

  const buildAutoComment = (): string => {
    const parts: string[] = [];
    if (relation) parts.push(relation.toLowerCase());
    const occ = customOccasion.trim() || occasion;
    if (occ) parts.push(`повод: ${occ}`);
    if (budgetMax) parts.push(`бюджет до ${budgetMax} ₽`);
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
        service_type: "gift",
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
    if (!relation && !recipientGender) {
      toast.error("Укажите, кому подбираем подарок");
      return;
    }
    if (!occasion && !customOccasion.trim()) {
      toast.error("Укажите повод для подарка");
      return;
    }
    const min = parseInt(budgetMin, 10);
    const max = parseInt(budgetMax, 10);
    if (!isNaN(min) && !isNaN(max) && min > max) {
      toast.error("Бюджет «от» больше, чем «до»");
      return;
    }
    scrollToResult();
    start(buildFormParams() as unknown as Record<string, unknown>);
  };

  const handleReset = () => {
    reset();
    setRecipientGender("");
    setRecipientAge("");
    setRelation("");
    setOccasion("");
    setCustomOccasion("");
    setBudgetMin("");
    setBudgetMax("");
    setZodiac("");
    setArchetypes([]);
    setColortypes([]);
    setInterests([]);
    setCustomInterests("");
    setGiftFormats([]);
    setSeason("");
    setTags([]);
    setAlreadyGifted("");
    setRestrictions("");
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
              Подбор подарков
            </h2>
            <p className="text-muted-foreground text-lg">
              Пять конкретных идей подарка под характер получателя, повод и ваш
              бюджет — с обоснованием и советом, где искать
            </p>
          </div>

          {!result && !isAnalyzing && (
            <div className="relative">
              <LockedFormOverlay cost={COST} actionLabel="подбора подарков">
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
                        <p className="font-medium mb-2">Пол получателя</p>
                        <Select
                          value={recipientGender}
                          onValueChange={setRecipientGender}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Не выбрано" />
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
                        <p className="font-medium mb-2">Возраст</p>
                        <Input
                          type="number"
                          min={1}
                          max={120}
                          placeholder="Например, 35"
                          value={recipientAge}
                          onChange={(e) => setRecipientAge(e.target.value)}
                        />
                      </div>
                      <div>
                        <p className="font-medium mb-2">
                          Кем приходится <span className="text-destructive">*</span>
                        </p>
                        <Select value={relation} onValueChange={setRelation}>
                          <SelectTrigger>
                            <SelectValue placeholder="Не выбрано" />
                          </SelectTrigger>
                          <SelectContent>
                            {RELATIONS.map((r) => (
                              <SelectItem key={r} value={r}>
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="font-medium mb-2">
                          Повод <span className="text-destructive">*</span>
                        </p>
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
                          placeholder="Или свой вариант повода"
                          value={customOccasion}
                          onChange={(e) => setCustomOccasion(e.target.value)}
                        />
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
                      title="Интересы и увлечения получателя"
                      hint="Чем точнее — тем лучше попадём в характер"
                      options={INTERESTS}
                      selected={interests}
                      onToggle={(v) => toggleTag(v, setInterests)}
                      custom={customInterests}
                      onCustomChange={setCustomInterests}
                    />

                    <TagPicker
                      title="Предпочтительный формат подарка"
                      options={GIFT_FORMATS}
                      selected={giftFormats}
                      onToggle={(v) => toggleTag(v, setGiftFormats)}
                    />

                    <div>
                      <p className="font-medium mb-2">
                        Архетип(ы) получателя по Карлу Юнгу{" "}
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
                        Цветотип внешности получателя{" "}
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
                          Сезон{" "}
                          <span className="text-muted-foreground text-xs">
                            (необязательно)
                          </span>
                        </p>
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
                    </div>

                    <TagPicker
                      title="Желаемое настроение подарка"
                      options={TAGS}
                      selected={tags}
                      onToggle={(v) => toggleTag(v, setTags)}
                    />

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="font-medium mb-2">
                          Что уже дарили раньше{" "}
                          <span className="text-muted-foreground text-xs">
                            (необязательно)
                          </span>
                        </p>
                        <Textarea
                          placeholder="Чтобы не повторяться: духи, книга по кулинарии..."
                          value={alreadyGifted}
                          onChange={(e) => setAlreadyGifted(e.target.value)}
                          rows={3}
                        />
                      </div>
                      <div>
                        <p className="font-medium mb-2">
                          Ограничения и стоп-темы{" "}
                          <span className="text-muted-foreground text-xs">
                            (необязательно)
                          </span>
                        </p>
                        <Textarea
                          placeholder="Аллергия на цветы, не пьёт алкоголь, не любит..."
                          value={restrictions}
                          onChange={(e) => setRestrictions(e.target.value)}
                          rows={3}
                        />
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
                        placeholder="Всё, что важно знать о получателе и ваших отношениях..."
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
                            name="Gift"
                            size={18}
                            className="mr-2 shrink-0"
                          />
                          <span className="min-w-0">
                            Подобрать подарки за {COST} ₽
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
                        Обязательны только получатель и повод. Чем больше
                        укажете — тем точнее подарки. Фото не нужно.
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
                  {statusText || "Подбираем подарки..."}
                </p>
                <p className="text-sm text-muted-foreground">
                  Обычно занимает меньше минуты. Не закрывайте страницу.
                </p>
              </CardContent>
            </Card>
          )}

          {result && !isAnalyzing && (
            <div ref={resultRef}>
              <GiftReport
                data={result}
                formParams={resultParams as GiftFormParams | null}
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
                question: "Нужно ли фото получателя?",
                answer:
                  "Нет, фото не требуется. Подарки подбираются по анкете: кто получатель, какой повод, интересы и бюджет.",
              },
              {
                question: "Сколько времени занимает подбор?",
                answer:
                  "Обычно меньше минуты. Не закрывайте страницу до завершения.",
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
              Сохраните параметры получателя, чтобы быстро подобрать подарок в
              следующий раз.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="gift-profile-name">Название анкеты</Label>
              <Input
                id="gift-profile-name"
                className="mt-1.5"
                placeholder="Например: Подарки маме"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                maxLength={120}
              />
            </div>
            <div>
              <Label htmlFor="gift-profile-comment">Комментарий</Label>
              <Textarea
                id="gift-profile-comment"
                className="mt-1.5"
                placeholder="Например: анкета для подарков на день рождения"
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