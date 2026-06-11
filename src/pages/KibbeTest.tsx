import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import {
  KibbeLetter,
  KibbeQuestion,
  getQuestions,
  getBranchTailQuestions,
  calculateKibbeResult,
  COMBINED_FIRST_QUESTION,
  KIBBE_TYPES,
  HEIGHT_THRESHOLD,
} from '@/data/kibbeTest';

const DB_QUERY_API = 'https://functions.poehali.dev/59a0379b-a4b5-4cec-b2d2-884439f64df9';

type Step = 'intro' | 'questions' | 'result';

export default function KibbeTest() {
  const { user, isLoading: authLoading } = useAuth();
  const { refetchKibbeHistory } = useData();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('intro');
  const [name, setName] = useState('');
  const [height, setHeight] = useState('');
  const [dominance, setDominance] = useState<'Вертикаль' | 'Изогнутая' | null>(null);
  const [useCombined, setUseCombined] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, KibbeLetter>>({});
  const [resultTypeKey, setResultTypeKey] = useState<string | null>(null);
  const [resultLetter, setResultLetter] = useState<KibbeLetter | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Список вопросов текущего прохождения.
  // - Рост >= 168: обычная вертикальная ветка (9 вопросов).
  // - Рост < 168: первый вопрос комбинированный (обе картинки), а хвост (3–10)
  //   подставляется после выбора доминанты.
  let questions: KibbeQuestion[];
  if (useCombined) {
    questions = dominance
      ? [COMBINED_FIRST_QUESTION, ...getBranchTailQuestions(dominance)]
      : [COMBINED_FIRST_QUESTION];
  } else {
    questions = getQuestions(dominance || 'Вертикаль');
  }

  // Всего вопросов в любой ветке — 9 (для стабильного прогресс-бара)
  const totalQuestions = 9;

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
          <Icon name="Loader2" className="animate-spin" size={48} />
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <section className="py-20">
          <div className="container max-w-md mx-auto px-4">
            <Card>
              <CardContent className="p-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-100">
                  <Icon name="Lock" size={32} className="text-purple-600" />
                </div>
                <h2 className="mb-2 text-2xl font-bold">Войдите, чтобы пройти тест</h2>
                <p className="mb-6 text-muted-foreground">
                  Бесплатный тест «Типаж по Кибби» доступен только зарегистрированным
                  пользователям. Войдите или создайте аккаунт — это бесплатно.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    onClick={() => navigate('/login')}
                    className="flex-1 bg-purple-600 text-white hover:bg-purple-700"
                  >
                    Войти
                  </Button>
                  <Button
                    onClick={() => navigate('/register')}
                    variant="outline"
                    className="flex-1 border-purple-600 text-purple-600 hover:bg-purple-50"
                  >
                    Зарегистрироваться
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </Layout>
    );
  }

  const handleStart = () => {
    if (!name.trim()) {
      toast.error('Введите имя');
      return;
    }
    const h = parseInt(height, 10);
    if (!h || h < 120 || h > 230) {
      toast.error('Введите корректный рост (в см)');
      return;
    }
    setAnswers({});
    setCurrentIndex(0);

    if (h >= HEIGHT_THRESHOLD) {
      // Высокий рост — однозначно Вертикаль, обычная ветка
      setUseCombined(false);
      setDominance('Вертикаль');
    } else {
      // Низкий рост — доминанта определится после первого (комбинированного) вопроса
      setUseCombined(true);
      setDominance(null);
    }
    setStep('questions');
  };

  const handleAnswer = (
    letter: KibbeLetter,
    optionIndex: number,
    event?: React.MouseEvent<HTMLButtonElement>,
  ) => {
    // Снимаем фокус, чтобы на мобильных не подсвечивалась кнопка
    // с тем же индексом в следующем вопросе
    event?.currentTarget.blur();
    const q = questions[currentIndex];

    // Комбинированный первый вопрос (рост < 168): определяем доминанту по варианту
    if (q.combined) {
      const opt = q.options[optionIndex];
      if (opt.disabled || !opt.dominance || !opt.branchLetter) return;

      const chosenDominance = opt.dominance;
      const branchQuestions = getQuestions(chosenDominance);
      const firstBranchId = branchQuestions[0].id; // '2V' или '2I'

      const newAnswers = { ...answers, [firstBranchId]: opt.branchLetter };
      setDominance(chosenDominance);
      setAnswers(newAnswers);
      setCurrentIndex(1);
      return;
    }

    const newAnswers = { ...answers, [q.id]: letter };
    setAnswers(newAnswers);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      finishTest(newAnswers);
    }
  };

  const finishTest = async (finalAnswers: Record<string, KibbeLetter>) => {
    const dom = dominance || 'Вертикаль';
    const { winningLetter, typeKey } = calculateKibbeResult(dom, finalAnswers);
    setResultLetter(winningLetter);
    setResultTypeKey(typeKey);
    setStep('result');
    await saveResult(winningLetter, typeKey, finalAnswers);
  };

  const saveResult = async (
    winningLetter: KibbeLetter,
    typeKey: string,
    finalAnswers: Record<string, KibbeLetter>,
  ) => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('session_token');
      const typeInfo = KIBBE_TYPES[typeKey];
      const response = await fetch(DB_QUERY_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'X-Session-Token': token } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          table: 'kibbe_test_history',
          action: 'insert',
          data: {
            user_id: user.id,
            user_name: name.trim(),
            height: parseInt(height, 10),
            dominance: dominance || 'Вертикаль',
            winning_letter: winningLetter,
            kibbe_type: typeInfo?.name || '',
            answers: JSON.stringify(finalAnswers),
            status: 'completed',
          },
        }),
      });
      const result = await response.json();
      if (!result.success) throw new Error('save failed');
      await refetchKibbeHistory();
    } catch (error) {
      toast.error('Результат показан, но не удалось сохранить в историю');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestart = () => {
    setStep('intro');
    setName('');
    setHeight('');
    setAnswers({});
    setCurrentIndex(0);
    setUseCombined(false);
    setDominance(null);
    setResultTypeKey(null);
    setResultLetter(null);
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      // Возврат на комбинированный первый вопрос — сбрасываем выбранную доминанту
      if (useCombined && currentIndex === 1) {
        setDominance(null);
      }
      setCurrentIndex(currentIndex - 1);
    } else {
      setStep('intro');
    }
  };

  return (
    <Layout>
      <section className="py-12 md:py-20">
        <div className="container max-w-3xl mx-auto px-4">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Типаж по Кибби — бесплатный тест</h1>
            <p className="text-muted-foreground">
              Ответьте честно, ориентируясь на естественное состояние тела. В конце вы узнаете
              свой типаж из 10 по системе Дэвида Кибби.
            </p>
          </div>

          {step === 'intro' && (
            <Card>
              <CardContent className="p-6 md:p-8 space-y-6">
                <div>
                  <label className="font-medium mb-2 block">Как вас зовут?</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ваше имя"
                  />
                </div>
                <div>
                  <label className="font-medium mb-2 block">Ваш рост без обуви, см</label>
                  <Input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder="Например, 165"
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    Рост помогает определить вашу доминанту. При росте 168 см и выше — это Вертикаль.
                    При меньшем росте доминанту уточним по первому вопросу.
                  </p>
                </div>
                <Button
                  size="lg"
                  className="w-full bg-purple-600 text-white hover:bg-purple-700"
                  onClick={handleStart}
                >
                  Начать тест
                </Button>
              </CardContent>
            </Card>
          )}

          {step === 'questions' && (
            <Card>
              <CardContent className="p-6 md:p-8 space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2 text-sm text-muted-foreground">
                    <span>
                      Вопрос {currentIndex + 1} из {totalQuestions}
                    </span>
                    {dominance && <span>Доминанта: {dominance}</span>}
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-purple-600 transition-all"
                      style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <h2 className="text-xl font-semibold mb-2">{questions[currentIndex].title}</h2>
                  {questions[currentIndex].description && (
                    <p className="text-muted-foreground mb-4">
                      {questions[currentIndex].description}
                    </p>
                  )}
                  {questions[currentIndex].images && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      {questions[currentIndex].images!.map((img, i) => (
                        <img
                          key={i}
                          src={img}
                          alt="Схема силуэтов"
                          className="w-full rounded-xl border"
                        />
                      ))}
                    </div>
                  )}
                  {questions[currentIndex].image && (
                    <img
                      src={questions[currentIndex].image}
                      alt="Схема силуэтов"
                      className="w-full rounded-xl border mb-4"
                    />
                  )}
                </div>

                <div className="space-y-3">
                  {questions[currentIndex].options.map((opt, optIndex) => {
                    const isCombined = questions[currentIndex].combined;
                    const selected =
                      !isCombined && answers[questions[currentIndex].id] === opt.letter;
                    const heightCm = parseInt(height, 10) || 0;
                    // При высоком росте (>=168, ветка «Вертикаль» без комбинированного вопроса)
                    // в «Тесте с тканью» доступны только первые 3 силуэта (А, Б, В)
                    const isTallVerticalSilhouette =
                      !useCombined &&
                      dominance === 'Вертикаль' &&
                      questions[currentIndex].id === '2V';
                    const disabledByTallVertical = isTallVerticalSilhouette && optIndex > 2;
                    // В комбинированном вопросе при росте > 166 см силуэт J (миниатюрная
                    // изогнутая) недоступен
                    const disabledByTallCurved =
                      isCombined &&
                      heightCm > 166 &&
                      opt.dominance === 'Изогнутая' &&
                      opt.branchLetter === 'Д';
                    const isDisabled =
                      !!opt.disabled || disabledByTallVertical || disabledByTallCurved;
                    return (
                      <button
                        key={optIndex}
                        disabled={isDisabled}
                        onClick={(e) => handleAnswer(opt.letter, optIndex, e)}
                        className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                          isDisabled
                            ? 'cursor-not-allowed opacity-40'
                            : 'hover:border-purple-400 hover:bg-purple-50'
                        } ${
                          selected ? 'border-purple-600 bg-purple-50 ring-1 ring-purple-600' : ''
                        }`}
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-100 font-semibold text-purple-700">
                          {opt.letter}
                        </span>
                        <span className="pt-0.5">{opt.text}</span>
                      </button>
                    );
                  })}
                </div>

                {(() => {
                  const heightCm = parseInt(height, 10) || 0;
                  const q = questions[currentIndex];
                  const tallVerticalHint = !useCombined && dominance === 'Вертикаль' && q.id === '2V';
                  const tallCurvedHint = !!q.combined && heightCm > 166;
                  if (!tallVerticalHint && !tallCurvedHint) return null;
                  return (
                    <p className="flex items-start gap-2 rounded-lg bg-purple-50 px-3 py-2 text-sm text-muted-foreground">
                      <Icon name="Info" size={16} className="mt-0.5 shrink-0 text-purple-600" />
                      <span>
                        Некоторые силуэты недоступны: при вашем росте они подходят только для более
                        низких фигур.
                      </span>
                    </p>
                  );
                })()}

                <Button variant="ghost" onClick={handleBack}>
                  <Icon name="ChevronLeft" size={18} className="mr-1" />
                  Назад
                </Button>
              </CardContent>
            </Card>
          )}

          {step === 'result' && resultTypeKey && (
            <Card>
              <CardContent className="p-6 md:p-8 space-y-6 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-purple-100">
                  <Icon name="Sparkles" size={32} className="text-purple-600" />
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">{name}, ваш типаж по Кибби:</p>
                  <h2 className="text-3xl font-bold text-purple-700">
                    {KIBBE_TYPES[resultTypeKey].name}
                  </h2>
                  <p className="mt-2 text-muted-foreground">
                    Доминанта: {KIBBE_TYPES[resultTypeKey].dominance} · Линия:{' '}
                    {KIBBE_TYPES[resultTypeKey].line}
                  </p>
                </div>

                {KIBBE_TYPES[resultTypeKey].images &&
                  KIBBE_TYPES[resultTypeKey].images!.length > 0 && (
                    <div
                      className={`grid gap-4 ${
                        KIBBE_TYPES[resultTypeKey].images!.length > 1
                          ? 'grid-cols-1 sm:grid-cols-2'
                          : 'grid-cols-1'
                      }`}
                    >
                      {KIBBE_TYPES[resultTypeKey].images!.map((img, i) => (
                        <img
                          key={i}
                          src={img}
                          alt={KIBBE_TYPES[resultTypeKey].name}
                          className="w-full rounded-xl border"
                        />
                      ))}
                    </div>
                  )}

                <div className="text-left">
                  <h3 className="mb-2 flex items-center gap-2 font-semibold">
                    <Icon name="Info" size={20} className="text-purple-600" />
                    Описание типажа
                  </h3>
                  <p className="whitespace-pre-line text-muted-foreground">
                    {KIBBE_TYPES[resultTypeKey].detailedDescription ||
                      KIBBE_TYPES[resultTypeKey].shortDescription}
                  </p>
                </div>

                {KIBBE_TYPES[resultTypeKey].silhouette && (
                  <div className="text-left">
                    <h3 className="mb-2 flex items-center gap-2 font-semibold">
                      <Icon name="Shapes" size={20} className="text-purple-600" />
                      Силуэт
                    </h3>
                    <p className="text-muted-foreground">
                      {KIBBE_TYPES[resultTypeKey].silhouette}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap justify-center gap-2">
                  {KIBBE_TYPES[resultTypeKey].keywords.map((kw) => (
                    <span
                      key={kw}
                      className="rounded-full bg-purple-100 px-3 py-1 text-sm text-purple-700"
                    >
                      {kw}
                    </span>
                  ))}
                </div>

                <p className="text-sm text-muted-foreground">
                  Примеры: {KIBBE_TYPES[resultTypeKey].celebrities.join(', ')}
                </p>

                {isSaving && (
                  <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Icon name="Loader2" size={16} className="animate-spin" />
                    Сохраняем результат в историю...
                  </p>
                )}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    className="flex-1 bg-purple-600 text-white hover:bg-purple-700"
                    onClick={() => navigate('/profile/history-kibbe')}
                  >
                    <Icon name="History" size={18} className="mr-2" />
                    Моя история тестов
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={handleRestart}>
                    <Icon name="RotateCcw" size={18} className="mr-2" />
                    Пройти ещё раз
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </Layout>
  );
}