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
  getQuestions,
  calculateKibbeResult,
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
  const [dominance, setDominance] = useState<'Вертикаль' | 'Изогнутая'>('Вертикаль');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, KibbeLetter>>({});
  const [resultTypeKey, setResultTypeKey] = useState<string | null>(null);
  const [resultLetter, setResultLetter] = useState<KibbeLetter | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const questions = getQuestions(dominance);

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
    const dom = h >= HEIGHT_THRESHOLD ? 'Вертикаль' : 'Изогнутая';
    setDominance(dom);
    setAnswers({});
    setCurrentIndex(0);
    setStep('questions');
  };

  const handleAnswer = (letter: KibbeLetter) => {
    const q = questions[currentIndex];
    const newAnswers = { ...answers, [q.id]: letter };
    setAnswers(newAnswers);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      finishTest(newAnswers);
    }
  };

  const finishTest = async (finalAnswers: Record<string, KibbeLetter>) => {
    const { winningLetter, typeKey } = calculateKibbeResult(dominance, finalAnswers);
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
            dominance,
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
    setResultTypeKey(null);
    setResultLetter(null);
  };

  const handleBack = () => {
    if (currentIndex > 0) {
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
                    По росту мы автоматически определим вашу доминанту: 168 см и выше — Вертикаль,
                    ниже 168 см — Изогнутая.
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
                      Вопрос {currentIndex + 1} из {questions.length}
                    </span>
                    <span>Доминанта: {dominance}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-purple-600 transition-all"
                      style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
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
                  {questions[currentIndex].image && (
                    <img
                      src={questions[currentIndex].image}
                      alt="Схема силуэтов"
                      className="w-full rounded-xl border mb-4"
                    />
                  )}
                </div>

                <div className="space-y-3">
                  {questions[currentIndex].options.map((opt) => {
                    const selected = answers[questions[currentIndex].id] === opt.letter;
                    return (
                      <button
                        key={opt.letter}
                        onClick={() => handleAnswer(opt.letter)}
                        className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors hover:border-purple-400 hover:bg-purple-50 ${
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

                <p className="text-left">{KIBBE_TYPES[resultTypeKey].shortDescription}</p>

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
