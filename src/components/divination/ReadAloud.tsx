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

  const speakFrom = useCallback((i: number, run: number) => {
    if (stoppedRef.current || run !== runRef.current) return;
    const chunks = chunksRef.current;
    if (i >= chunks.length) {
      setSpeaking(false);
      setPaused(false);
      return;
    }
    idxRef.current = i;

    const u = new SpeechSynthesisUtterance(chunks[i]);
    u.lang = "ru-RU";
    u.rate = rateRef.current;
    u.pitch = 1;
    const voice = pickVoice();
    if (voice) u.voice = voice;

    u.onend = () => {
      if (run === runRef.current) speakFrom(i + 1, run);
    };
    u.onerror = () => {
      // Прерывание из-за смены скорости — не ошибка, новый запуск уже идёт
      if (run !== runRef.current) return;
      setSpeaking(false);
      setPaused(false);
    };
    window.speechSynthesis.speak(u);
  }, []);

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
    stoppedRef.current = false;
    rateRef.current = rate;
    const run = ++runRef.current;
    window.speechSynthesis.cancel();
    setSpeaking(true);
    setPaused(false);
    setTimeout(() => speakFrom(0, run), 60);
  };

  const stop = () => {
    stoppedRef.current = true;
    runRef.current++;
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setPaused(false);
  };

  const togglePause = () => {
    if (paused) {
      window.speechSynthesis.resume();
      setPaused(false);
    } else {
      window.speechSynthesis.pause();
      setPaused(true);
    }
  };

  // Скорость меняется на лету: дочитываем с той же фразы, но уже быстрее
  const changeRate = () => {
    const steps = [0.75, 1, 1.25, 1.5, 1.75];
    const next = steps[(steps.indexOf(rate) + 1) % steps.length];
    setRate(next);
    rateRef.current = next;
    if (speaking) {
      const from = idxRef.current;
      const run = ++runRef.current;
      window.speechSynthesis.cancel();
      setPaused(false);
      // Небольшая пауза: браузеру нужно время оборвать прошлую фразу
      setTimeout(() => speakFrom(from, run), 80);
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