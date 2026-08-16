import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ReadAloudProps {
  text: string;
  /** Компактный вид — для ответов внутри диалога */
  compact?: boolean;
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
const ReadAloud = ({ text, compact = false }: ReadAloudProps) => {
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
   * Запускает чтение ТОЛЬКО после того, как браузер реально замолчал.
   * Команда cancel() выполняется с задержкой и, если позвать speak() сразу,
   * она убивает уже запущенную новую фразу — голос просто пропадает.
   */
  const restartAt = useCallback(
    (i: number, run: number, from = 0) => {
      window.speechSynthesis.cancel();

      // Android разрешает запускать голос ТОЛЬКО в момент нажатия кнопки.
      // Поэтому читаем сразу же, не откладывая ни на миг.
      speakFromRef.current?.(i, run, from);

      // Настольный Chrome выполняет «замолчи» с задержкой и может убить
      // только что запущенную фразу. Если через полсекунды тишина —
      // запускаем ещё раз: к этому моменту браузер уже освободился.
      let waited = 0;
      const check = () => {
        if (run !== runRef.current || stoppedRef.current) return;
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
          return;
        }
        if (waited > 1500) return;
        waited += 250;
        if (waited >= 500) {
          speakFromRef.current?.(i, run, from);
          return;
        }
        setTimeout(check, 250);
      };
      setTimeout(check, 250);
    },
    [],
  );

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

    // Режем по предложениям и склеиваем до ~200 знаков:
    // так голос не обрывается и звучит естественно
    const sentences = clean.match(/[^.!?…]+[.!?…]*/g) || [clean];
    const chunks: string[] = [];
    let buf = "";
    sentences.forEach((s) => {
      if ((buf + s).length > 200) {
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
    rateRef.current = rate;
    const run = ++runRef.current;
    setSpeaking(true);
    setPaused(false);
    restartAt(0, run);
  };

  const stop = () => {
    stoppedRef.current = true;
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
        runRef.current++;
        window.speechSynthesis.cancel();
        setPaused(true);
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [speaking, paused]);

  /**
   * Пауза и продолжение. Штатная команда «продолжить» не работает
   * на Android и часто виснет в Chrome, поэтому продолжаем сами —
   * дочитываем с той фразы, на которой остановились.
   */
  const togglePause = () => {
    if (paused) {
      const at = idxRef.current;
      const fromChar = charRef.current;
      stoppedRef.current = false;
      const run = ++runRef.current;
      setPaused(false);
      restartAt(at, run, fromChar);
    } else {
      // Меняем номер запуска, чтобы обрыв не потянул за собой следующую фразу
      runRef.current++;
      window.speechSynthesis.cancel();
      setPaused(true);
    }
  };

  // Скорость меняется на лету: дочитываем с той же фразы, но уже быстрее
  const changeRate = () => {
    const steps = [0.75, 1, 1.25, 1.5, 1.75];
    const next = steps[(steps.indexOf(rate) + 1) % steps.length];
    setRate(next);
    rateRef.current = next;
    // На паузе просто запоминаем скорость — она сработает при продолжении
    if (speaking && !paused) {
      const at = idxRef.current;
      const fromChar = charRef.current;
      const run = ++runRef.current;
      restartAt(at, run, fromChar);
    }
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
          Слушать
        </Button>
      ) : (
        <>
          <Button
            size={size}
            variant="ghost"
            onClick={togglePause}
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
            title="Нажмите, чтобы изменить скорость чтения"
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