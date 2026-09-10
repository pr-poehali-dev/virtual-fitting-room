import { createPortal } from "react-dom";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { divTheme } from "./theme";
import { isMobileDevice, shareDialogText } from "./SavedDialogs";

interface ConfirmCloseDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Спрашиваем поверх страницы: кнопка «Закрыть диалог» внизу, и врезка
 * в потоке уезжала за экран — человек не видел, что у него спросили
 */
export const ConfirmCloseDialog = ({
  onConfirm,
  onCancel,
}: ConfirmCloseDialogProps) =>
  createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div
        className={`${divTheme.panel} max-h-[90vh] w-full max-w-md overflow-y-auto p-5`}
      >
        <div className="mb-3 flex items-start gap-2">
          <Icon
            name="TriangleAlert"
            size={20}
            className="mt-0.5 shrink-0 text-[#c9a84c]"
          />
          <div className="text-sm text-[#e8d9a8]">
            <p className="mb-1 font-medium text-[#f3ecff]">
              Закрыть эту беседу?
            </p>
            <p>
              Незакрытая беседа остаётся здесь: к ней можно вернуться и
              продолжить разговор — гадалка помнит всё, о чём вы говорили.
              Закрытые беседы тут не показываются, но сохраняются в личном
              кабинете, в разделе{" "}
              <a
                href="/profile/history-divination"
                className="font-medium text-[#c9a84c] underline underline-offset-2"
              >
                «Мои гадания»
              </a>{" "}
              — там их можно перечитать.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onConfirm} size="sm" className={divTheme.btnPrimary}>
            Закрыть беседу
          </Button>
          <Button
            variant="ghost"
            onClick={onCancel}
            size="sm"
            className={divTheme.btnGhost}
          >
            Отмена
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );

interface ClosedPanelProps {
  stepsCount: number;
  dialogId: string | null;
  onDownload: () => void;
}

/** Беседа закрыта: итог и кнопки «поделиться» / «скачать». */
export const ClosedPanel = ({
  stepsCount,
  dialogId,
  onDownload,
}: ClosedPanelProps) => (
  <div className={`${divTheme.panel} p-5 text-center`}>
    <Icon name="CheckCircle2" size={28} className="mx-auto mb-2 text-[#c9a84c]" />
    <p className="text-[#f3ecff]">Диалог закрыт</p>
    <p className={`mt-1 text-sm ${divTheme.muted}`}>
      Задано вопросов: {stepsCount}
    </p>
    {/* Беседа осталась в кабинете — подсказываем, где её перечитать */}
    <p className="mx-auto mt-3 max-w-md text-sm text-[#e8d9a8]">
      Беседа сохранена в личном кабинете, в разделе{" "}
      <a
        href="/profile/history-divination"
        className="font-medium text-[#c9a84c] underline underline-offset-2"
      >
        «Мои гадания»
      </a>
      .
    </p>
    <div className="mt-3 flex flex-wrap justify-center gap-2">
      <Button
        size="sm"
        onClick={() => dialogId && shareDialogText(dialogId)}
        className={divTheme.btnPrimary}
      >
        <Icon
          name={isMobileDevice() ? "Share2" : "Copy"}
          size={15}
          className="mr-1.5"
        />
        {isMobileDevice() ? "Поделиться беседой" : "Скопировать беседу"}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={onDownload}
        className={divTheme.btnGhost}
      >
        <Icon name="Download" size={15} className="mr-1.5" />
        Скачать
      </Button>
    </div>
  </div>
);

interface LimitPanelProps {
  maxSteps: number;
  dialogId: string | null;
  onAskClose: () => void;
  onDownload: () => void;
}

/** Достигнут предел вопросов: форма скрыта, остаются действия с беседой. */
export const LimitPanel = ({
  maxSteps,
  dialogId,
  onAskClose,
  onDownload,
}: LimitPanelProps) => (
  <div className={`${divTheme.panel} p-5 text-center`}>
    <p className="text-[#f3ecff]">Достигнут предел в {maxSteps} вопросов</p>
    <p className={`mt-1 text-sm ${divTheme.muted}`}>
      Начните новый диалог, чтобы продолжить
    </p>
    {/* Форма вопроса тут скрыта, поэтому даём отдельную кнопку закрытия:
        иначе беседу нечем убрать из незавершённых. */}
    <p className="mx-auto mt-3 max-w-md text-sm text-[#e8d9a8]">
      Закройте беседу, чтобы убрать её отсюда — она останется в личном кабинете,
      в разделе{" "}
      <a
        href="/profile/history-divination"
        className="font-medium text-[#c9a84c] underline underline-offset-2"
      >
        «Мои гадания»
      </a>
      .
    </p>
    <div className="mt-3 flex flex-wrap justify-center gap-2">
      <Button size="sm" onClick={onAskClose} className={divTheme.btnPrimary}>
        <Icon name="CheckCircle2" size={15} className="mr-1.5" />
        Закрыть беседу
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => dialogId && shareDialogText(dialogId)}
        className={divTheme.btnGhost}
      >
        <Icon
          name={isMobileDevice() ? "Share2" : "Copy"}
          size={15}
          className="mr-1.5"
        />
        {isMobileDevice() ? "Поделиться" : "Скопировать"}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={onDownload}
        className={divTheme.btnGhost}
      >
        <Icon name="Download" size={15} className="mr-1.5" />
        Скачать
      </Button>
    </div>
  </div>
);
