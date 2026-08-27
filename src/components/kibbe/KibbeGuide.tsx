import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '@/components/ui/icon';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { KIBBE_TYPES, SILHOUETTE_IMAGE_VERTICAL, SILHOUETTE_IMAGE_CURVED } from '@/data/kibbeTest';
import {
  GUIDE_IMAGES,
  GUIDE_LINES,
  GUIDE_COMBOS,
  GUIDE_NOTES,
  GUIDE_PHOTO_STEPS,
  typeSlug,
} from '@/data/kibbeGuide';

/** Картинка, которая открывается крупно в модальном окне */
function ZoomImage({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative block w-full cursor-zoom-in"
      >
        <img src={src} alt={alt} loading="lazy" className="w-full rounded-xl border" />
        <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-lg bg-black/60 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
          <Icon name="Maximize2" size={12} />
          Открыть крупно
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] p-2 sm:max-w-5xl">
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          <img src={src} alt={alt} className="max-h-[85vh] w-full rounded-lg object-contain" />
        </DialogContent>
      </Dialog>
    </>
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

/**
 * Инструкция по самостоятельному определению типажа.
 * asPage — режим отдельной страницы: заголовок становится главным (h1) и без отступа сверху.
 */
export default function KibbeGuide({ asPage = false }: { asPage?: boolean }) {
  const Heading = asPage ? 'h1' : 'h2';
  return (
    <div className={asPage ? 'space-y-6' : 'mt-12 space-y-6'}>
      <div className="text-center">
        <Heading className="text-2xl font-bold md:text-3xl">
          Как определить свой типаж самостоятельно
        </Heading>
        <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
          Материал по новой книге Дэвида Кибби. Такой информации пока почти нет в открытом
          доступе — мы собрали её в удобную шпаргалку, чтобы вы могли разобраться сами.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-8 p-5 md:p-8">
          <section>
            <StepTitle number={1}>Сделайте фото и нарисуйте линию ткани</StepTitle>
            <ol className="mb-4 space-y-2">
              {GUIDE_PHOTO_STEPS.map((text, i) => (
                <li key={i} className="flex gap-3 text-muted-foreground">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-semibold text-purple-700">
                    {i + 1}
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ol>
            <p className="rounded-lg bg-purple-50 p-3 text-sm text-muted-foreground">
              Это не контур вашего тела. Смотрите только на то, где тело выталкивает
              воображаемую ткань, а где не выталкивает. Правильный ответ даёт только
              нарисованная линия, а не оценка своей фигуры на глаз.
            </p>
          </section>

          <section>
            <StepTitle number={2}>Определите доминанту</StepTitle>
            <p className="mb-4 text-muted-foreground">
              Если линия идёт относительно прямо вниз — ваша доминанта вертикальная. Если ткань
              выдвинута вперёд грудью и бёдрами — доминанта изгиб.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border p-4">
                <img
                  src={SILHOUETTE_IMAGE_VERTICAL}
                  alt="Вертикальная доминанта"
                  loading="lazy"
                  className="mx-auto mb-3 max-h-48 rounded-lg"
                />
                <p className="font-medium">Вертикаль (Vertical)</p>
                <p className="text-sm text-muted-foreground">
                  При росте 168 см и выше — автоматически, исключений нет. Возможна и при любом
                  росте ниже.
                </p>
              </div>
              <div className="rounded-xl border p-4">
                <img
                  src={SILHOUETTE_IMAGE_CURVED}
                  alt="Изогнутая доминанта"
                  loading="lazy"
                  className="mx-auto mb-3 max-h-48 rounded-lg"
                />
                <p className="font-medium">Изгиб (Curve)</p>
                <p className="text-sm text-muted-foreground">
                  Только при росте ниже 168 см — и то не автоматически: вертикаль при таком
                  росте тоже возможна.
                </p>
              </div>
            </div>
          </section>

          <section>
            <StepTitle number={3}>Определите дополнительную линию</StepTitle>
            <p className="mb-4 text-muted-foreground">
              Доминанту вы уже знаете — осталась вторая половина вашей линии, именно она делает
              её уникальной. Красными линиями на схеме показано, как ложится воображаемая ткань
              и где именно проявляется дополнительная линия.
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
            <StepTitle number={4}>Найдите свою комбинацию</StepTitle>
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