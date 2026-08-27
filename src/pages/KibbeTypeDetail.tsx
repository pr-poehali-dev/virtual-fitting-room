import { useParams, Link, Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import Icon from '@/components/ui/icon';
import { Card, CardContent } from '@/components/ui/card';
import { KIBBE_TYPES } from '@/data/kibbeTest';
import { GUIDE_COMBOS, slugToTypeKey, typeSlug } from '@/data/kibbeGuide';

export default function KibbeTypeDetail() {
  const { slug } = useParams<{ slug: string }>();
  const typeKey = slug ? slugToTypeKey(slug) : '';
  const info = KIBBE_TYPES[typeKey];

  if (!info) {
    return <Navigate to="/kibbe-types" replace />;
  }

  const index = GUIDE_COMBOS.findIndex((c) => c.typeKey === typeKey);
  const prev = index > 0 ? GUIDE_COMBOS[index - 1] : null;
  const next = index >= 0 && index < GUIDE_COMBOS.length - 1 ? GUIDE_COMBOS[index + 1] : null;

  return (
    <Layout>
      <section className="py-12 md:py-20">
        <div className="container mx-auto max-w-3xl px-2 md:px-4">
          <Link
            to="/kibbe-types"
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-purple-700"
          >
            <Icon name="ChevronLeft" size={16} />
            Все типажи
          </Link>

          <Card>
            <CardContent className="space-y-6 px-3 py-6 md:p-8">
              <div className="text-center">
                <h1 className="text-3xl font-bold text-purple-700">{info.name}</h1>
                <p className="mt-2 text-muted-foreground">
                  Доминанта: {info.dominance} · Линия: {info.line}
                </p>
              </div>

              {info.images && info.images.length > 0 && (
                <div
                  className={`grid gap-4 ${
                    info.images.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
                  }`}
                >
                  {info.images.map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      alt={info.name}
                      loading="lazy"
                      className="w-full rounded-xl border"
                    />
                  ))}
                </div>
              )}

              <div>
                <h2 className="mb-2 flex items-center gap-2 font-semibold">
                  <Icon name="Info" size={20} className="text-purple-600" />
                  Описание типажа
                </h2>
                <p className="whitespace-pre-line text-muted-foreground">
                  {info.detailedDescription || info.shortDescription}
                </p>
              </div>

              {info.silhouette && (
                <div>
                  <h2 className="mb-2 flex items-center gap-2 font-semibold">
                    <Icon name="Shapes" size={20} className="text-purple-600" />
                    Силуэт
                  </h2>
                  <p className="text-muted-foreground">{info.silhouette}</p>
                </div>
              )}

              <div>
                <h2 className="mb-3 flex items-center gap-2 font-semibold">
                  <Icon name="Tags" size={20} className="text-purple-600" />
                  Ключевые слова
                </h2>
                <div className="flex flex-wrap gap-2">
                  {info.keywords.map((kw) => (
                    <span
                      key={kw}
                      className="rounded-full bg-purple-100 px-3 py-1 text-sm text-purple-700"
                    >
                      {kw}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="mb-2 flex items-center gap-2 font-semibold">
                  <Icon name="Star" size={20} className="text-purple-600" />
                  Знаменитости-примеры
                </h2>
                <p className="text-muted-foreground">{info.celebrities.join(', ')}</p>
              </div>

              <Link
                to="/kibbe-test"
                className="flex items-center justify-center gap-2 rounded-xl bg-purple-600 p-3 font-medium text-white transition-colors hover:bg-purple-700"
              >
                <Icon name="Ruler" size={18} />
                Пройти бесплатный тест
              </Link>
            </CardContent>
          </Card>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-between">
            {prev ? (
              <Link
                to={`/kibbe-types/${typeSlug(prev.typeKey)}`}
                className="flex items-center gap-2 rounded-xl border p-3 text-sm transition-colors hover:border-purple-300 hover:bg-purple-50"
              >
                <Icon name="ChevronLeft" size={16} className="text-purple-600" />
                {KIBBE_TYPES[prev.typeKey]?.name}
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link
                to={`/kibbe-types/${typeSlug(next.typeKey)}`}
                className="flex items-center gap-2 rounded-xl border p-3 text-sm transition-colors hover:border-purple-300 hover:bg-purple-50"
              >
                {KIBBE_TYPES[next.typeKey]?.name}
                <Icon name="ChevronRight" size={16} className="text-purple-600" />
              </Link>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}
