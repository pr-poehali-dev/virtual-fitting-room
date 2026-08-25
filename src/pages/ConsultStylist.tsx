import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import LockedFormOverlay from "@/components/LockedFormOverlay";
import FaqAccordion from "@/components/FaqAccordion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import Icon from "@/components/ui/icon";
import { useAuth } from "@/context/AuthContext";
import { CONSULT_COST, GENERATION_COST } from "@/config/prices";
import { useScrollToResult } from "@/hooks/useScrollToResult";
import { useTextSelectionTask } from "@/hooks/useTextSelectionTask";
import ConsultPhotoUpload from "@/components/consult/ConsultPhotoUpload";
import ConsultReport, { ConsultResult } from "@/components/consult/ConsultReport";
import ConsultImageBlock, {
  ConsultPhoto,
  PhotoRole,
} from "@/components/consult/ConsultImageBlock";

const MAX_REFERENCES = 3;
const QUESTION_PLACEHOLDER =
  "Например: подскажи, с чем носить это пальто, мой типаж — Романтик. Подбери верх, обувь и сумку. Без каблуков.";

export default function ConsultStylist() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { resultRef, scrollToResult } = useScrollToResult<HTMLDivElement>();

  const [personPhotos, setPersonPhotos] = useState<string[]>([]);
  const [references, setReferences] = useState<string[]>([]);
  const [question, setQuestion] = useState("");
  const [wantPrompt, setWantPrompt] = useState(true);
  const [promptPurpose, setPromptPurpose] = useState("");

  const { isAnalyzing, statusText, result, resultParams, taskId, start, reset } =
    useTextSelectionTask<ConsultResult>(
      "consult",
      CONSULT_COST,
      "Ответ готов!",
    );

  const handleAsk = () => {
    if (!user) {
      toast.error("Войдите в аккаунт");
      navigate("/login");
      return;
    }
    if (!question.trim()) {
      toast.error("Напишите вопрос");
      return;
    }
    scrollToResult();
    start({
      question: question.trim(),
      want_prompt: wantPrompt,
      prompt_purpose: promptPurpose.trim(),
      person_photo: personPhotos[0] || "",
      reference_urls: references,
    });
  };

  const handleReset = () => {
    reset();
    setQuestion("");
    setPromptPurpose("");
    setPersonPhotos([]);
    setReferences([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const askedQuestion = (resultParams?.question as string) || question;
  const resultPerson = (resultParams?.person_photo as string) || "";
  const resultRefs = (resultParams?.reference_urls as string[]) || [];
  const usage = Array.isArray(result?.photo_usage) ? result.photo_usage : [];

  // Роль фото предлагает нейросеть; если не указала — своё фото это внешность,
  // референс — вещь.
  const normalizeRole = (raw: unknown, fallback: PhotoRole): PhotoRole => {
    const value = String(raw || "").toLowerCase();
    if (value === "person" || value === "item" || value === "both") return value;
    return fallback;
  };

  const photos: ConsultPhoto[] = [];
  if (resultPerson) {
    photos.push({
      url: resultPerson,
      label: "Ваше фото",
      why: usage[0]?.why,
      role: normalizeRole(usage[0]?.role, "person"),
    });
  }
  resultRefs.forEach((url, i) => {
    const usageItem = usage[photos.length];
    photos.push({
      url,
      label: `Референс ${i + 1}`,
      why: usageItem?.why,
      role: normalizeRole(usageItem?.role, "item"),
    });
  });

  const imagePrompt = (result?.image_prompt || "").trim();

  return (
    <Layout>
      <section className="py-20 px-4">
        <div className="w-full mx-auto max-w-4xl">
          <div className="text-center mb-12 animate-fade-in">
            <h2 className="text-5xl md:text-6xl font-light mb-4">
              Консультация ИИ-стилиста
            </h2>
            <p className="text-muted-foreground text-lg">
              Задайте вопрос своими словами и получите развёрнутый ответ. По
              желанию нейросеть составит промпт для генерации картинки — и
              нарисует её прямо здесь
            </p>
          </div>

          {!result && !isAnalyzing && (
            <div className="relative">
              <LockedFormOverlay cost={CONSULT_COST}>
                <Card>
                  <CardContent className="p-6 space-y-6">
                    <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
                      <p className="flex items-start gap-2 text-sm text-gray-700">
                        <Icon
                          name="Sparkles"
                          size={18}
                          className="mt-0.5 shrink-0 text-purple-600"
                        />
                        <span>
                          Здесь можно спросить о стиле, одежде и внешности —
                          нейросеть ответит как персональный стилист. Тема
                          вопроса может быть и любой другой: сервис одинаково
                          работает с вопросами не про моду.
                        </span>
                      </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <ConsultPhotoUpload
                        title="Ваше фото"
                        hint="Добавьте, если хотите совет с учётом вашей внешности и фигуры"
                        images={personPhotos}
                        onChange={setPersonPhotos}
                        max={1}
                        badge={() => "Вы"}
                        disabled={isAnalyzing}
                      />
                      <ConsultPhotoUpload
                        title="Референсы"
                        hint="Фото вещей, образов или любых других изображений, о которых спрашиваете"
                        images={references}
                        onChange={setReferences}
                        max={MAX_REFERENCES}
                        badge={(i) => `Референс ${i + 1}`}
                        disabled={isAnalyzing}
                      />
                    </div>

                    <div>
                      <Label htmlFor="consult-question" className="mb-1 block">
                        Ваш вопрос <span className="text-destructive">*</span>
                      </Label>
                      <Textarea
                        id="consult-question"
                        rows={5}
                        placeholder={QUESTION_PLACEHOLDER}
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        maxLength={2000}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Спросить можно о чём угодно — не только про одежду.
                        Пишите конкретно: чем подробнее вопрос, тем точнее ответ.
                      </p>
                    </div>

                    <div className="rounded-xl border p-4 space-y-3">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <Checkbox
                          checked={wantPrompt}
                          onCheckedChange={(v) => setWantPrompt(Boolean(v))}
                          className="mt-0.5"
                        />
                        <span>
                          <span className="block text-sm font-medium">
                            Нужен готовый промпт для генерации картинки
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            Нейросеть составит описание картинки — после ответа
                            её можно будет нарисовать здесь же за{" "}
                            {GENERATION_COST} ₽
                          </span>
                        </span>
                      </label>

                      {wantPrompt && (
                        <div>
                          <Label
                            htmlFor="consult-purpose"
                            className="mb-1 block text-sm"
                          >
                            Для чего нужен промпт
                          </Label>
                          <Input
                            id="consult-purpose"
                            placeholder="Например: показать меня в этом образе в полный рост"
                            value={promptPurpose}
                            onChange={(e) => setPromptPurpose(e.target.value)}
                            maxLength={300}
                          />
                        </div>
                      )}
                    </div>

                    <Button
                      onClick={handleAsk}
                      disabled={isAnalyzing}
                      size="lg"
                      className="w-full"
                    >
                      <Icon name="Send" size={18} className="mr-2" />
                      Получить ответ — {CONSULT_COST} ₽
                    </Button>
                  </CardContent>
                </Card>
              </LockedFormOverlay>
            </div>
          )}

          <div ref={resultRef}>
            {isAnalyzing && (
              <Card>
                <CardContent className="p-10 text-center">
                  <Icon
                    name="Loader2"
                    size={36}
                    className="mx-auto mb-4 animate-spin text-primary"
                  />
                  <p className="font-medium">
                    {statusText || "Думаем над ответом..."}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Обычно занимает меньше минуты. Не закрывайте страницу.
                  </p>
                </CardContent>
              </Card>
            )}

            {result && !isAnalyzing && (
              <div className="space-y-4">
                <ConsultReport
                  data={result}
                  question={askedQuestion}
                  onReset={handleReset}
                />
                {imagePrompt && (
                  <ConsultImageBlock
                    taskId={taskId}
                    initialPrompt={imagePrompt}
                    photos={photos}
                  />
                )}
              </div>
            )}
          </div>

          <FaqAccordion
            items={[
              {
                question: "Нужно ли добавлять фото?",
                answer:
                  "Нет, все фото необязательны. Своё фото стоит добавить, если хотите совет с учётом внешности, а референсы — если спрашиваете про конкретную вещь или изображение. Можно задать вопрос и вообще без фото.",
              },
              {
                question: "Можно спросить не про одежду?",
                answer:
                  "Да. Подсказки на странице написаны про моду, потому что это самый частый запрос, но сервис отвечает на вопросы любой темы и составит промпт под вашу задачу.",
              },
              {
                question: "Обязательно ли генерировать картинку?",
                answer: `Нет. Ответ и промпт вы получаете за ${CONSULT_COST} ₽ и можете этим ограничиться. Картинка рисуется только по кнопке и стоит ${GENERATION_COST} ₽.`,
              },
              {
                question: "Где сохраняются ответы?",
                answer: user ? (
                  <div>
                    <p className="mb-3">
                      Все консультации сохраняются в личном кабинете вместе с
                      картинкой, если вы её создавали.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => navigate("/profile/history-colorguide")}
                    >
                      <Icon name="Images" size={18} className="mr-2" />
                      Мои консультации
                    </Button>
                  </div>
                ) : (
                  <p>
                    Все консультации сохраняются в личном кабинете. Войдите в
                    аккаунт, чтобы они были доступны вам в любой момент.
                  </p>
                ),
              },
            ]}
          />
        </div>
      </section>
    </Layout>
  );
}