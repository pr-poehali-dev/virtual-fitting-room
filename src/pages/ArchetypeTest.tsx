import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import ArchetypeTopCard from '@/components/ArchetypeTopCard';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import {
  OptionLetter,
  ARCHETYPE_QUESTIONS,
  TOTAL_QUESTIONS,
  ARCHETYPES,
  calculateArchetypeResult,
  ArchetypeResult,
} from '@/data/archetypeTest';

const DB_QUERY_API = 'https://functions.poehali.dev/59a0379b-a4b5-4cec-b2d2-884439f64df9';

type Step = 'intro' | 'questions' | 'result';

export default function ArchetypeTest() {
  const { user, isLoading: authLoading } = useAuth();
  const { refetchArchetypeHistory } = useData();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('intro');
  const [name, setName] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, OptionLetter>>({});
  const [result, setResult] = useState<ArchetypeResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
                  Бесплатный тест «Архетип по Юнгу» доступен только зарегистрированным
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
    setAnswers({});
    setCurrentIndex(0);
    setStep('questions');
  };

  const handleAnswer = (letter: OptionLetter) => {
    const q = ARCHETYPE_QUESTIONS[currentIndex];
    const newAnswers = { ...answers, [q.id]: letter };
    setAnswers(newAnswers);

    if (currentIndex < ARCHETYPE_QUESTIONS.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      finishTest(newAnswers);
    }
  };

  const finishTest = async (finalAnswers: Record<string, OptionLetter>) => {
    const res = calculateArchetypeResult(finalAnswers);
    setResult(res);
    setStep('result');
    await saveResult(res, finalAnswers);
  };

  const saveResult = async (
    res: ArchetypeResult,
    finalAnswers: Record<string, OptionLetter>,
  ) => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('session_token');
      const topNames = res.top.map((t) => t.name).join(', ');
      const response = await fetch(DB_QUERY_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'X-Session-Token': token } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          table: 'archetype_test_history',
          action: 'insert',
          data: {
            user_id: user.id,
            user_name: name.trim(),
            top_archetype: res.top[0]?.key || '',
            top_archetype_name: res.top[0]?.name || '',
            top_names: topNames,
            scores: JSON.stringify(
              res.scores.reduce((acc, s) => ({ ...acc, [s.key]: s.score }), {}),
            ),
            answers: JSON.stringify(finalAnswers),
            status: 'completed',
          },
        }),
      });
      const result = await response.json();
      if (!result.success) throw new Error('save failed');
      await refetchArchetypeHistory();
    } catch (error) {
      toast.error('Результат показан, но не удалось сохранить в историю');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestart = () => {
    setStep('intro');
    setName('');
    setAnswers({});
    setCurrentIndex(0);
    setResult(null);
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else {
      setStep('intro');
    }
  };

  const renderResultHeadline = (res: ArchetypeResult) => {
    if (res.tiedTop) {
      const tied = res.scores.filter((s) => s.score === res.scores[0].score);
      const names = tied.map((t) => t.name).join(' и ');
      return (
        <p className="mt-2 text-muted-foreground">
          У вас одинаково ярко выражены сразу {tied.length}{' '}
          {tied.length === 2 ? 'архетипа' : 'архетипа'}: {names}.
        </p>
      );
    }
    const rest = res.top.slice(1).map((t) => t.name);
    return (
      <p className="mt-2 text-muted-foreground">
        У вас преобладает архетип <span className="font-semibold">{res.top[0]?.name}</span>
        {rest.length > 0 && <> , и в меньшей степени — {rest.join(', ')}.</>}
      </p>
    );
  };

  return (
    <Layout>
      <section className="py-12 md:py-20">
        <div className="container max-w-3xl mx-auto px-4">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              Архетип по Юнгу — бесплатный тест
            </h1>
            <p className="text-muted-foreground">
              Ответьте на 36 вопросов, выбирая наиболее близкий вам вариант. В конце вы узнаете
              свой ведущий архетип из 12 по системе Карла Юнга.
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
                <p className="text-sm text-muted-foreground">
                  В тесте 36 вопросов. Отвечайте интуитивно — выбирайте тот вариант, который
                  откликается вам сильнее всего.
                </p>
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
                      Вопрос {currentIndex + 1} из {TOTAL_QUESTIONS}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-purple-600 transition-all"
                      style={{ width: `${((currentIndex + 1) / TOTAL_QUESTIONS) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  <h2 className="text-xl font-semibold mb-2">
                    {ARCHETYPE_QUESTIONS[currentIndex].title}
                  </h2>
                </div>

                <div className="space-y-3">
                  {ARCHETYPE_QUESTIONS[currentIndex].options.map((opt) => {
                    const selected =
                      answers[ARCHETYPE_QUESTIONS[currentIndex].id] === opt.letter;
                    return (
                      <button
                        key={opt.letter}
                        onClick={() => handleAnswer(opt.letter)}
                        className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors [@media(hover:hover)]:hover:border-purple-400 [@media(hover:hover)]:hover:bg-purple-50 ${
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

          {step === 'result' && result && (
            <Card>
              <CardContent className="p-6 md:p-8 space-y-6">
                <div className="text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-purple-100">
                    <Icon name="Sparkles" size={32} className="text-purple-600" />
                  </div>
                  <p className="text-muted-foreground mb-1 mt-4">{name}, ваш результат:</p>
                  <h2 className="text-3xl font-bold text-purple-700">{result.top[0]?.name}</h2>
                  {renderResultHeadline(result)}
                </div>

                {result.top[0] && ARCHETYPES[result.top[0].key].image && (
                  <img
                    src={ARCHETYPES[result.top[0].key].image}
                    alt={result.top[0].name}
                    className="mx-auto w-full max-w-sm rounded-xl border"
                  />
                )}

                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 font-semibold">
                    <Icon name="Info" size={20} className="text-purple-600" />
                    {result.tiedTop ? 'Ваши ведущие архетипы' : 'Ваш топ-3 архетипов'}
                  </h3>
                  {result.allEqual && (
                    <div className="flex items-start gap-2 rounded-xl border border-purple-200 bg-purple-50 p-3 text-sm text-purple-700">
                      <Icon name="Sparkles" size={18} className="mt-0.5 shrink-0" />
                      <span>
                        У вас редкое сочетание всех архетипов — они выражены поровну.
                      </span>
                    </div>
                  )}
                  {result.top.map((t, i) => (
                    <ArchetypeTopCard
                      key={t.key}
                      archetypeKey={t.key}
                      name={t.name}
                      percent={t.percent}
                      index={i}
                    />
                  ))}
                </div>

                <div className="space-y-2">
                  <h3 className="flex items-center gap-2 font-semibold">
                    <Icon name="BarChart3" size={20} className="text-purple-600" />
                    Полное распределение
                  </h3>
                  {result.scores.map((s) => (
                    <div key={s.key} className="flex items-center gap-3">
                      <span className="w-32 shrink-0 text-sm text-muted-foreground">{s.name}</span>
                      <div className="h-2 flex-1 rounded-full bg-muted">
                        <div
                          className="h-2 rounded-full bg-purple-600"
                          style={{ width: `${s.percent}%` }}
                        />
                      </div>
                      <span className="w-12 shrink-0 text-right text-sm text-muted-foreground">
                        {s.percent}%
                      </span>
                    </div>
                  ))}
                </div>

                {isSaving && (
                  <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Icon name="Loader2" size={16} className="animate-spin" />
                    Сохраняем результат в историю...
                  </p>
                )}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    className="flex-1 bg-purple-600 text-white hover:bg-purple-700"
                    onClick={() => navigate('/profile/history-archetype')}
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