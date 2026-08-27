import { Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import Icon from '@/components/ui/icon';
import { Card, CardContent } from '@/components/ui/card';
import { KIBBE_TYPES } from '@/data/kibbeTest';
import { GUIDE_COMBOS, typeSlug, typeLookImage } from '@/data/kibbeGuide';

export default function KibbeTypes() {
  return (
    <Layout>
      <section className="py-12 md:py-20">
        <div className="container mx-auto max-w-5xl px-4">
          <Link
            to="/kibbe-test"
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-purple-700"
          >
            <Icon name="ChevronLeft" size={16} />
            Вернуться к тесту
          </Link>

          <div className="mb-8 text-center">
            <h1 className="mb-2 text-3xl font-bold md:text-4xl">
              10 типажей по системе Дэвида Кибби
            </h1>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              Подробные описания всех типажей: силуэт, ткани, гардероб, украшения, макияж и
              цвета. Читайте свободно — проходить тест необязательно.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {GUIDE_COMBOS.map((combo) => {
              const info = KIBBE_TYPES[combo.typeKey];
              if (!info) return null;
              return (
                <Link key={combo.typeKey} to={`/kibbe-types/${typeSlug(combo.typeKey)}`}>
                  <Card className="flex h-full flex-col overflow-hidden transition-shadow hover:shadow-lg">
                    <img
                      src={typeLookImage(combo.typeKey)}
                      alt={`Образ для типажа ${info.name}`}
                      loading="lazy"
                      className="aspect-[11/10] w-full bg-white object-contain"
                    />
                    <CardContent className="p-5">
                      <h2 className="mb-1 text-lg font-semibold">{info.name}</h2>
                      <p className="mb-2 text-sm text-purple-700">
                        {info.dominance} · {info.line}
                      </p>
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {info.shortDescription}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>

          <div className="mt-10 text-center">
            <Link
              to="/kibbe-test"
              className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-6 py-3 font-medium text-white transition-colors hover:bg-purple-700"
            >
              <Icon name="Ruler" size={18} />
              Пройти бесплатный тест
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}