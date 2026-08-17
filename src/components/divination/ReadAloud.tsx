import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ReadAloudProps {
  text: string;
  /** Компактный вид — для ответов внутри диалога */
  compact?: boolean;
  /** Своя подпись на кнопке: рядом могут стоять кнопки на разный текст */
  label?: string;
}

/** Убирает значки разметки, чтобы голос не читал «решётка решётка звёздочка». */
const cleanForSpeech = (raw: string) =>
  raw
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^>\s*/gm, "")
    .replace(/^-{3,}$/gm, " ")
    .replace(/\|/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

/**
 * Браузер читает текст вслух: длинные толкования удобнее слушать.
 * Синтез речи встроен в устройство — бесплатно и без обращений к серверу.
 *
 * Длинный текст режем на предложения: браузеры обрывают чтение
 * на длинных кусках (в Chrome — примерно через 15 секунд).
 */
const ReadAloud = ({
  text,
  compact = false,
  label = "Слушать",
}: ReadAloudProps) => {
  const [supported, setSupported] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [rate, setRate] = useState(1);

  const chunksRef = useRef<string[]>([]);
  const idxRef = useRef(0);
  const rateRef = useRef(1);
  const stoppedRef = useRef(false);
  // Номер запуска: команда cancel() «добивает» прошлое чтение и вызывает
  // его обработчики — по номеру отличаем их от актуального запуска
  const runRef = useRef(0);
  const speakFromRef = useRef<
    ((i: number, run: number, from?: number) => void) | null
  >(null);
  // Мягкая пауза: текущую фразу дочитываем, следующую не начинаем.
  // Прерывать речь на полуслове нельзя — Android после этого не даёт
  // запустить голос заново, и «Продолжить» просто молчит.
  const pauseRef = useRef(false);
  // Сколько знаков текущей фразы уже прочитано — чтобы продолжить с этого места
  const charRef = useRef(0);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  // Уходим со страницы — голос замолкает, иначе он продолжит читать
  useEffect(
    () => () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    },
    [],
  );

  const pickVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    const ru = voices.filter((v) => v.lang?.toLowerCase().startsWith("ru"));
    if (!ru.length) return null;
    // Женский голос ближе к образу гадалки
    const female = ru.find((v) => /milena|alena|female|женск/i.test(v.name));
    return female || ru[0];
  };

  /**
   * Старт с нуля: глушим прошлое чтение и сразу запускаем новое.
   * Запуск делаем в тот же миг, что и нажатие, — Android не даёт
   * включать голос отложенно.
   */
  const restartAt = useCallback((i: number, run: number, from = 0) => {
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();
    speakFromRef.current?.(i, run, from);
  }, []);

  const speakFrom = useCallback((i: number, run: number, from = 0) => {
    if (stoppedRef.current || run !== runRef.current) return;
    const chunks = chunksRef.current;
    if (i >= chunks.length) {
      setSpeaking(false);
      setPaused(false);
      return;
    }
    idxRef.current = i;

    // Продолжаем с середины фразы — но только с границы слова,
    // иначе голос начнёт с обрывка вроде «ложение карт»
    const full = chunks[i];
    let offset = 0;
    if (from > 0 && from < full.length - 1) {
      const cut = full.lastIndexOf(" ", from);
      offset = cut > 0 ? cut + 1 : 0;
    }
    charRef.current = offset;

    const u = new SpeechSynthesisUtterance(full.slice(offset));
    u.lang = "ru-RU";
    u.rate = rateRef.current;
    u.pitch = 1;
    const voice = pickVoice();
    if (voice) u.voice = voice;

    // Браузер сообщает, какое слово читает — запоминаем позицию,
    // чтобы после паузы продолжить с неё, а не с начала фразы
    u.onboundary = (e) => {
      if (run === runRef.current && typeof e.charIndex === "number") {
        charRef.current = offset + e.charIndex;
      }
    };
    u.onend = () => {
      if (run !== runRef.current) return;
      charRef.current = 0;
      idxRef.current = i + 1;
      // Нажали «Пауза» — останавливаемся на границе фраз
      if (pauseRef.current) return;
      speakFrom(i + 1, run);
    };
    u.onerror = () => {
      // Прерывание из-за смены скорости — не ошибка, новый запуск уже идёт
      if (run !== runRef.current) return;
      setSpeaking(false);
      setPaused(false);
    };
    // Chrome иногда остаётся в «поставленном на паузу» состоянии после
    // прошлых команд — тогда новая фраза молчит. Снимаем это принудительно.
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(u);
  }, []);

  speakFromRef.current = speakFrom;

  const start = () => {
    const clean = cleanForSpeech(text);
    if (!clean) return;

    // Режем по предложениям и склеиваем до ~120 знаков. Короткие куски
    // нужны для паузы: она срабатывает на границе фраз, и с длинными
    // кусками пришлось бы ждать окончания слишком долго.
    const sentences = clean.match(/[^.!?…]+[.!?…]*/g) || [clean];
    const chunks: string[] = [];
    let buf = "";
    sentences.forEach((s) => {
      if ((buf + s).length > 120) {
        if (buf) chunks.push(buf.trim());
        buf = s;
      } else {
        buf += s;
      }
    });
    if (buf.trim()) chunks.push(buf.trim());

    chunksRef.current = chunks;
    charRef.current = 0;
    stoppedRef.current = false;
    pauseRef.current = false;
    rateRef.current = rate;
    const run = ++runRef.current;
    setSpeaking(true);
    setPaused(false);
    restartAt(0, run);
  };

  const stop = () => {
    stoppedRef.current = true;
    pauseRef.current = false;
    runRef.current++;
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setPaused(false);
  };

  // Свернули вкладку — телефон обрывает речь. Показываем это как паузу,
  // чтобы кнопка «Продолжить» вернула чтение с той же фразы
  useEffect(() => {
    const onHide = () => {
      if (document.hidden && speaking && !paused) {
        pauseRef.current = true;
        setPaused(true);
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [speaking, paused]);

  /**
   * Пауза и продолжение.
   *
   * Речь НЕ обрываем: ставим флаг, текущая фраза дочитывается до точки,
   * а следующая не начинается. Так надёжно на всех устройствах — Android
   * после принудительного обрыва отказывается запускать голос снова.
   */
  const togglePause = () => {
    if (paused) {
      pauseRef.current = false;
      stoppedRef.current = false;
      setPaused(false);
      // Речь уже идёт (фраза не успела дочитаться) — просто снимаем флаг
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        return;
      }
      const run = ++runRef.current;
      speakFrom(idxRef.current, run);
    } else {
      pauseRef.current = true;
      setPaused(true);
    }
  };

  // Скорость применяется со следующей фразы: обрывать текущую нельзя,
  // иначе на телефоне голос больше не запустится
  const changeRate = () => {
    const steps = [0.75, 1, 1.25, 1.5, 1.75];
    const next = steps[(steps.indexOf(rate) + 1) % steps.length];
    setRate(next);
    rateRef.current = next;
  };

  if (!supported) return null;

  const size = compact ? "sm" : "default";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!speaking ? (
        <Button
          size={size}
          variant="ghost"
          onClick={() => {
            if (!cleanForSpeech(text)) {
              toast.error("Нечего читать");
              return;
            }
            start();
          }}
          className="bg-white/5 text-[#e8e0f0] ring-1 ring-white/20 hover:bg-white/10 hover:text-white"
        >
          <Icon name="Volume2" size={16} className="mr-1.5" />
          {label}
        </Button>
      ) : (
        <>
          <Button
            size={size}
            variant="ghost"
            onClick={togglePause}
            title={
              paused
                ? "Продолжить чтение"
                : "Пауза — голос договорит фразу и остановится"
            }
            className="bg-white/5 text-[#e8e0f0] ring-1 ring-white/20 hover:bg-white/10 hover:text-white"
          >
            <Icon name={paused ? "Play" : "Pause"} size={16} className="mr-1.5" />
            {paused ? "Продолжить" : "Пауза"}
          </Button>
          <Button
            size={size}
            variant="ghost"
            onClick={stop}
            className="bg-white/5 text-[#e8e0f0] ring-1 ring-white/20 hover:bg-white/10 hover:text-white"
          >
            <Icon name="Square" size={16} className="mr-1.5" />
            Стоп
          </Button>
          <Button
            size={size}
            variant="ghost"
            onClick={changeRate}
            title="Скорость чтения — применится со следующей фразы"
            className="bg-white/5 text-[#e8e0f0] ring-1 ring-white/20 hover:bg-white/10 hover:text-white"
          >
            <Icon name="Gauge" size={16} className="mr-1.5" />
            {rate}×
          </Button>
        </>
      )}
    </div>
  );
};

export default ReadAloud;