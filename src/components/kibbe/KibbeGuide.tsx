import { Link } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import { Card, CardContent } from '@/components/ui/card';
import { KIBBE_TYPES, SILHOUETTE_IMAGE_VERTICAL, SILHOUETTE_IMAGE_CURVED } from '@/data/kibbeTest';
import {
  GUIDE_IMAGES,
  GUIDE_LINES,
  GUIDE_COMBOS,
  GUIDE_NOTES,
  typeSlug,
} from '@/data/kibbeGuide';

/** Картинка, которая открывается в полном размере в новой вкладке */
function ZoomImage({ src, alt }: { src: string; alt: string }) {
  return (
    <a href={src} target="_blank" rel="noreferrer" className="group relative block">
      <img src={src} alt={alt} loading="lazy" className="w-full rounded-xl border" />
      <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
        <Icon name="Maximize2" size={12} />
        Открыть крупно
      </span>
    </a>
  );
}

function StepTitle({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <h3 className="mb-3 flex items-center gap-3 text-lg font-semibold">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-600 text-sm text-white">
        {number}
      </span>
      {children}
    </h3>
  );
}

export default function KibbeGuide() {
  return (
    <div className="mt-12 space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold md:text-3xl">
          Как определить свой типаж самостоятельно
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
          Материал по новой книге Дэвида Кибби. Такой информации пока почти нет в открытом
          доступе — мы собрали её в удобную шпаргалку, чтобы вы могли разобраться сами.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-8 p-5 md:p-8">
          <section>
            <StepTitle number={1}>Измерьте рост</StepTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border p-4">
                <img
                  src={SILHOUETTE_IMAGE_VERTICAL}
                  alt="Вертикальная доминанта"
                  loading="lazy"
                  className="mx-auto mb-3 max-h-48 rounded-lg"
                />
                <p className="font-medium">168 см и выше</p>
                <p className="text-sm text-muted-foreground">
                  Доминанта вертикальная (Vertical)
                </p>
              </div>
              <div className="rounded-xl border p-4">
                <img
                  src={SILHOUETTE_IMAGE_CURVED}
                  alt="Изогнутая доминанта"
                  loading="lazy"
                  className="mx-auto mb-3 max-h-48 rounded-lg"
                />
                <p className="font-medium">Ниже 168 см</p>
                <p className="text-sm text-muted-foreground">Доминанта изогнутая (Curve)</p>
              </div>
            </div>
          </section>

          <section>
            <StepTitle number={2}>Определите дополнительную линию</StepTitle>
            <p className="mb-4 text-muted-foreground">
              Это основа вашего типажа. Сделайте фото в облегающей одежде — купальник или
              леггинсы, встаньте прямо, руки вдоль тела. Представьте, как тяжёлая ткань падает
              от ваших плеч; на рисунке она показана красными линиями.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {GUIDE_LINES.map((line) => (
                <div key={line.latin} className="rounded-xl border p-4">
                  <p className="font-medium">
                    {line.title}{' '}
                    <span className="text-sm font-normal text-muted-foreground">
                      ({line.latin})
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{line.text}</p>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <ZoomImage src={GUIDE_IMAGES.lines} alt="Линии силуэта по системе Кибби" />
            </div>
          </section>

          <section>
            <StepTitle number={3}>Найдите свою комбинацию</StepTitle>
            <p className="mb-4 text-muted-foreground">
              Доминанта + дополнительная линия = ваш типаж. Нажмите на строку, чтобы прочитать
              подробную статью.
            </p>
            <div className="space-y-2">
              {GUIDE_COMBOS.map((combo) => {
                const info = KIBBE_TYPES[combo.typeKey];
                if (!info) return null;
                return (
                  <Link
                    key={combo.typeKey}
                    to={`/kibbe-types/${typeSlug(combo.typeKey)}`}
                    className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:border-purple-300 hover:bg-purple-50"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-semibold text-purple-700">
                      {combo.number}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{info.name}</span>
                      <span className="block text-sm text-muted-foreground">
                        {combo.dominance} + {combo.line}
                      </span>
                    </span>
                    <Icon name="ChevronRight" size={18} className="shrink-0 text-purple-600" />
                  </Link>
                );
              })}
            </div>
            <div className="mt-4">
              <ZoomImage src={GUIDE_IMAGES.types} alt="10 типажей внешности по Дэвиду Кибби" />
            </div>
          </section>

          <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h3 className="mb-2 flex items-center gap-2 font-semibold">
              <Icon name="TriangleAlert" size={20} className="text-amber-600" />
              Важно
            </h3>
            <ul className="space-y-1.5 text-sm text-gray-700">
              {GUIDE_NOTES.map((note) => (
                <li key={note} className="flex gap-2">
                  <Icon name="Dot" size={18} className="shrink-0 text-amber-600" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="mb-3 text-lg font-semibold">Что дальше</h3>
            <p className="mb-4 text-muted-foreground">
              Как только вы определили типаж, откройте его статью — там разбор силуэтов, тканей,
              гардероба, украшений, макияжа и цветов именно для вас.
            </p>
            <ZoomImage
              src={GUIDE_IMAGES.dresses}
              alt="10 идеальных платьев по типам фигур Дэвида Кибби"
            />
            <Link
              to="/kibbe-types"
              className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-purple-600 p-3 font-medium text-white transition-colors hover:bg-purple-700"
            >
              <Icon name="LayoutGrid" size={18} />
              Все 10 типажей с описаниями
            </Link>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
