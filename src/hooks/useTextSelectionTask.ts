import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useBalance } from "@/context/BalanceContext";
import { playReadySound } from "@/components/selection/selectionUtils";

const START_API =
  "https://functions.poehali.dev/1551f3e9-8029-441b-ac77-2dc9cf164bdc";
const STATUS_API =
  "https://functions.poehali.dev/ce27daee-90c0-4dd7-9369-a6b079895493";

const POLLING_INTERVAL = 5000;
const TIMEOUT_DURATION = 300000;

/**
 * Запуск и отслеживание текстового подбора (подарки, ароматы).
 * Работает по той же схеме, что подбор образов, но без фото и картинки.
 */
export function useTextSelectionTask<TResult>(
  serviceType: "gift" | "perfume",
  cost: number,
  successMessage: string,
) {
  const { user } = useAuth();
  const { refreshBalance } = useBalance();
  const navigate = useNavigate();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [result, setResult] = useState<TResult | null>(null);
  const [resultParams, setResultParams] = useState<Record<
    string,
    unknown
  > | null>(null);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const stopTimers = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    pollingRef.current = null;
    timeoutRef.current = null;
  }, []);

  useEffect(() => stopTimers, [stopTimers]);

  const poll = useCallback(
    async (taskId: string) => {
      try {
        const token = localStorage.getItem("session_token");
        const res = await fetch(`${STATUS_API}?task_id=${taskId}`, {
          headers: token ? { "X-Session-Token": token } : {},
          credentials: "include",
        });
        const data = await res.json();

        if (data.status === "completed") {
          stopTimers();
          if (!data.result) {
            setIsAnalyzing(false);
            setStatusText("");
            toast.error("Не удалось получить результат. Попробуйте ещё раз.");
            return;
          }
          setResult(data.result as TResult);
          if (data.form_params) setResultParams(data.form_params);
          setIsAnalyzing(false);
          setStatusText("");
          playReadySound();
          toast.success(successMessage);
          refreshBalance();
        } else if (data.status === "failed") {
          stopTimers();
          setIsAnalyzing(false);
          setStatusText("");
          toast.error(data.error || "Ошибка подбора. Попробуйте ещё раз.");
          refreshBalance();
        } else if (data.status === "processing") {
          setStatusText("Анализируем анкету и подбираем варианты...");
        } else if (data.status === "pending") {
          setStatusText("Готовим запуск...");
        }
      } catch (e) {
        console.error("[TextSelection] polling error:", e);
      }
    },
    [refreshBalance, stopTimers, successMessage],
  );

  const start = useCallback(
    async (formParams: Record<string, unknown>) => {
      if (!user) {
        toast.error("Войдите в аккаунт");
        navigate("/login");
        return;
      }

      setIsAnalyzing(true);
      setStatusText("Запуск подбора...");
      setResult(null);
      setResultParams(null);

      try {
        const token = localStorage.getItem("session_token");
        const response = await fetch(START_API, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "X-Session-Token": token } : {}),
          },
          credentials: "include",
          body: JSON.stringify({
            service_type: serviceType,
            form_params: formParams,
          }),
        });
        const data = await response.json();

        if (!response.ok) {
          if (response.status === 402) {
            toast.error(`Недостаточно средств. Требуется ${cost} ₽`);
            navigate("/profile/wallet");
            setIsAnalyzing(false);
            return;
          }
          throw new Error(data.error || "Failed to start");
        }

        setStatusText("Обработка начата...");
        pollingRef.current = setInterval(() => poll(data.task_id), POLLING_INTERVAL);
        timeoutRef.current = setTimeout(() => {
          stopTimers();
          setIsAnalyzing(false);
          setStatusText("");
          toast.error(
            "Подбор занял слишком много времени. Попробуйте ещё раз.",
            { duration: 10000 },
          );
        }, TIMEOUT_DURATION);
      } catch (error) {
        setIsAnalyzing(false);
        setStatusText("");
        toast.error(
          error instanceof Error ? error.message : "Ошибка запуска подбора",
        );
      }
    },
    [cost, navigate, poll, serviceType, stopTimers, user],
  );

  const reset = useCallback(() => {
    setResult(null);
    setResultParams(null);
  }, []);

  return { isAnalyzing, statusText, result, resultParams, start, reset };
}
