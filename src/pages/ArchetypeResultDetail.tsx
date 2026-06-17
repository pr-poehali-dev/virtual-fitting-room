import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import ArchetypeTopCard from '@/components/ArchetypeTopCard';
import { ARCHETYPES, ARCHETYPE_ORDER, ArchetypeKey, TOTAL_QUESTIONS } from '@/data/archetypeTest';

const DB_QUERY_API = 'https://functions.poehali.dev/59a0379b-a4b5-4cec-b2d2-884439f64df9';

interface ArchetypeRecord {
  id: string;
  user_id: string;
  user_name: string;
  top_archetype: string;
  top_archetype_name: string;
  top_names: string;
  scores: Record<string, number> | string | null;
  created_at: string;
}

export default function ArchetypeResultDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [record, setRecord] = useState<ArchetypeRecord | null>(null);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user || !id) return;
    let cancelled = false;

    const fetchDetail = async () => {
      setIsLoading(true);
      try {
        const token = localStorage.getItem('session_token');
        const response = await fetch(DB_QUERY_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'X-Session-Token': token } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({
            table: 'archetype_test_history',
            action: 'select',
            where: { id, user_id: user.id },
            limit: 1,
          }),
        });
        const result = await response.json();
        if (cancelled) return;
        const data = result.success && Array.isArray(result.data) ? result.data : [];
        if (data.length === 0) {
          setErrorText('Результат не найден');
          return;
        }
        setRecord(data[0]);
      } catch (error) {
        if (!cancelled) setErrorText('Не удалось загрузить результат');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchDetail();
    return () => {
      cancelled = true;
    };
  }, [user, id]);

  if (authLoading || isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
          <Icon name="Loader2" className="animate-spin" size={48} />
        </div>
      </Layout>
    );
  }

  if (errorText || !record) {
    return (
      <Layout>
        <section className="py-20">
          <div className="container max-w-md mx-auto px-4 text-center">
            <Icon name="SearchX" size={48} className="mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">{errorText || 'Результат не найден'}</h2>
            <Button className="mt-4" onClick={() => navigate('/profile/history-archetype')}>
              К истории тестов
            </Button>
          </div>
        </section>
      </Layout>
    );
  }

  // Нормализуем scores
  let scoresObj: Record<string, number> = {};
  if (record.scores) {
    scoresObj =
      typeof record.scores === 'string'
        ? (JSON.parse(record.scores) as Record<string, number>)
        : (record.scores as Record<string, number>);
  }

  const orderIndex = (key: ArchetypeKey) => ARCHETYPE_ORDER.indexOf(key);
  const sorted = ARCHETYPE_ORDER.map((key) => ({
    key,
    name: ARCHETYPES[key].name,
    score: scoresObj[key] || 0,
    percent: Math.round(((scoresObj[key] || 0) * 100 * 10) / TOTAL_QUESTIONS) / 10,
  })).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return orderIndex(a.key) - orderIndex(b.key);
  });

  const maxScore = sorted[0]?.score ?? 0;
  const tied = sorted.filter((s) => s.score === maxScore && maxScore > 0);
  // Ведущие — архетипы с максимальным баллом (минимум один)
  const leaders = tied.length > 0 ? tied : sorted.slice(0, 1);
  const thirdScore = sorted[2]?.score ?? 0;
  const top = sorted.filter((s, i) => i < 3 || s.score === thirdScore);
  const allEqual =
    sorted.length > 0 && sorted.every((s) => s.score === sorted[0].score);

  return (
    <Layout>
      <section className="py-12 md:py-20">
        <div className="container max-w-3xl mx-auto px-4">
          <Button
            variant="ghost"
            className="mb-4"
            onClick={() => navigate('/profile/history-archetype')}
          >
            <Icon name="ChevronLeft" size={18} className="mr-1" />
            К истории тестов
          </Button>

          <Card>
            <CardContent className="p-6 md:p-8 space-y-6">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-purple-100">
                  <Icon name="Sparkles" size={32} className="text-purple-600" />
                </div>
                <p className="text-muted-foreground mb-1">{record.user_name}, ваш результат:</p>
                <h1 className="text-3xl font-bold text-purple-700">
                  {tied.length >= 2
                    ? tied
                        .map((t) => t.name)
                        .reduce(
                          (acc, name, i, arr) =>
                            i === 0
                              ? name
                              : i === arr.length - 1
                                ? `${acc} и ${name}`
                                : `${acc}, ${name}`,
                          '',
                        )
                    : record.top_archetype_name}
                </h1>
                {tied.length >= 2 ? (
                  <p className="mt-2 text-muted-foreground">
                    Одинаково ярко выражены сразу {tied.length} архетипа:{' '}
                    {tied.map((t) => t.name).join(' и ')}.
                  </p>
                ) : (
                  <p className="mt-2 text-muted-foreground">
                    Преобладает архетип {top[0]?.name}
                    {top.slice(1).length > 0 && (
                      <>, и в меньшей степени — {top.slice(1).map((t) => t.name).join(', ')}.</>
                    )}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="flex items-center gap-2 font-semibold">
                  <Icon name="Info" size={20} className="text-purple-600" />
                  {tied.length >= 2 ? 'Ваши ведущие архетипы' : 'Ваш топ-3 архетипов'}
                </h3>
                {allEqual && (
                  <div className="flex items-start gap-2 rounded-xl border border-purple-200 bg-purple-50 p-3 text-sm text-purple-700">
                    <Icon name="Sparkles" size={18} className="mt-0.5 shrink-0" />
                    <span>
                      У вас редкое сочетание всех архетипов — они выражены поровну.
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {leaders.map((t) => (
                    <div key={t.key} className="rounded-xl border p-2 text-center">
                      {ARCHETYPES[t.key]?.image && (
                        <img
                          src={ARCHETYPES[t.key].image}
                          alt={t.name}
                          className="mb-2 aspect-square w-full rounded-lg border object-cover"
                        />
                      )}
                      <div className="text-sm font-semibold text-purple-700">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.percent}%</div>
                    </div>
                  ))}
                </div>
                {top.map((t, i) => (
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
                {sorted.map((s) => (
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

              <Button
                className="w-full bg-purple-600 text-white hover:bg-purple-700"
                onClick={() => navigate('/archetype-test')}
              >
                <Icon name="RotateCcw" size={18} className="mr-2" />
                Пройти тест ещё раз
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </Layout>
  );
}