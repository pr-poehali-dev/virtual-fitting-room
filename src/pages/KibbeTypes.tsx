import { Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import Icon from '@/components/ui/icon';
import { Card, CardContent } from '@/components/ui/card';
import { KIBBE_TYPES } from '@/data/kibbeTest';
import { GUIDE_COMBOS, typeSlug } from '@/data/kibbeGuide';

export default function KibbeTypes() {
  return (
    <Layout>
      <section className="py-12 md:py-20">
        <div className="container mx-auto max-w-5xl px-4">
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
              const cover = info.images && info.images.length > 0 ? info.images[0] : null;
              return (
                <Link key={combo.typeKey} to={`/kibbe-types/${typeSlug(combo.typeKey)}`}>
                  <Card className="h-full overflow-hidden transition-shadow hover:shadow-lg">
                    {cover && (
                      <img
                        src={cover}
                        alt={info.name}
                        loading="lazy"
                        className="aspect-[4/3] w-full object-cover"
                      />
                    )}
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
