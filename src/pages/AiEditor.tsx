import { useState, useRef } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import { useAuth } from "@/context/AuthContext";

const ALLOWED_EMAIL = "apollinaria-b@yandex.ru";

type Mode = "chat" | "file" | "archive";

const MODES: { id: Mode; label: string; icon: string }[] = [
  { id: "chat", label: "Чат", icon: "MessageSquare" },
  { id: "file", label: "Файл", icon: "FileText" },
  { id: "archive", label: "Архив", icon: "FileArchive" },
];

const MODELS = [
  { id: "anthropic/claude-sonnet-4.6", label: "Sonnet 4.6 — $3/$15 за 1M" },
  { id: "anthropic/claude-opus-4.6", label: "Opus 4.6 — $5/$25 за 1M" },
  { id: "anthropic/claude-sonnet-4.5", label: "Sonnet 4.5 — $3/$15 за 1M" },
  { id: "anthropic/claude-sonnet-4", label: "Sonnet 4 — $3/$15 за 1M" },
];

const AI_EDITOR_API = "https://functions.poehali.dev/5289d2a6-e800-484c-9394-e26388888d13";

const TEXT_EXTENSIONS = [
  ".py", ".js", ".jsx", ".ts", ".tsx", ".html", ".css", ".scss", ".less",
  ".json", ".xml", ".yaml", ".yml", ".toml", ".ini", ".md", ".txt",
  ".sql", ".sh", ".vue", ".svelte", ".php", ".rb", ".go", ".rs",
  ".java", ".kt", ".swift", ".c", ".cpp", ".h", ".cs", ".lua",
  ".graphql", ".prisma", ".env", ".cfg", ".conf",
];

function isTextFile(name: string) {
  const lower = name.toLowerCase();
  return TEXT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export default function AiEditor() {
  const { user, isLoading } = useAuth();
  const [mode, setMode] = useState<Mode>("chat");
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState(MODELS[0].id);
  const [isProcessing, setIsProcessing] = useState(false);
  const [response, setResponse] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (isLoading) return null;
  if (!user || user.email !== ALLOWED_EMAIL) {
    return <Navigate to="/" replace />;
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (mode === "archive") {
      if (!selected.name.endsWith(".zip")) {
        toast.error("Загрузите ZIP-архив");
        return;
      }
      if (selected.size > 50 * 1024 * 1024) {
        toast.error("Максимальный размер — 50 МБ");
        return;
      }
    } else {
      if (!isTextFile(selected.name)) {
        toast.error("Загрузите текстовый файл (.ts, .py, .html, .css и др.)");
        return;
      }
      if (selected.size > 1 * 1024 * 1024) {
        toast.error("Максимальный размер файла — 1 МБ");
        return;
      }
    }

    setFile(selected);
    setResponse("");
  };

  const readFileAsBase64 = (f: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });
  };

  const readFileAsText = (f: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(f);
    });
  };

  const downloadBlob = (data: Uint8Array, filename: string, type: string) => {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      toast.error("Напишите промпт");
      return;
    }
    if (mode !== "chat" && !file) {
      toast.error(mode === "archive" ? "Загрузите ZIP-архив" : "Загрузите файл");
      return;
    }

    setIsProcessing(true);
    setResponse("");

    try {
      const payload: Record<string, string> = {
        prompt: prompt.trim(),
        model,
        mode,
      };

      if (mode === "archive" && file) {
        payload.archive_base64 = await readFileAsBase64(file);
        payload.filename = file.name;
      } else if (mode === "file" && file) {
        payload.file_content = await readFileAsText(file);
        payload.filename = file.name;
      }

      const res = await fetch(AI_EDITOR_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Ошибка обработки");
      }

      setResponse(data.ai_response || "");

      if (mode === "archive" && data.result_archive_base64) {
        const bytes = Uint8Array.from(atob(data.result_archive_base64), (c) => c.charCodeAt(0));
        downloadBlob(bytes, `edited_${file!.name}`, "application/zip");
        toast.success("Архив скачан!");
      } else if (mode === "file" && data.result_file_content) {
        const bytes = new TextEncoder().encode(data.result_file_content);
        downloadBlob(bytes, `edited_${file!.name}`, "text/plain");
        toast.success("Файл скачан!");
      } else if (mode === "chat") {
        toast.success("Ответ получен!");
      } else {
        toast.info("Ответ отображён ниже");
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Ошибка при обработке";
      toast.error(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    setFile(null);
    setResponse("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const canSubmit = prompt.trim() && !isProcessing && (mode === "chat" || file);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Icon name="Wand2" size={28} className="text-purple-400" />
          <h1 className="text-2xl font-bold">AI-редактор кода</h1>
        </div>

        <div className="space-y-6">
          <div className="flex gap-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => handleModeChange(m.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                  mode === m.id
                    ? "bg-purple-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                }`}
              >
                <Icon name={m.icon} size={18} />
                {m.label}
              </button>
            ))}
          </div>

          <Card className="bg-gray-900 border-gray-700">
            <CardContent className="pt-6 space-y-4">
              {mode !== "chat" && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {mode === "archive" ? "ZIP-архив с проектом" : "Файл для редактирования"}
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={mode === "archive" ? ".zip" : TEXT_EXTENSIONS.join(",")}
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-purple-500 transition-colors"
                  >
                    {file ? (
                      <div className="flex items-center justify-center gap-3">
                        <Icon
                          name={mode === "archive" ? "FileArchive" : "FileText"}
                          size={24}
                          className="text-purple-400"
                        />
                        <span className="text-gray-200">{file.name}</span>
                        <span className="text-gray-500 text-sm">
                          ({file.size < 1024 ? `${file.size} Б` : `${(file.size / 1024).toFixed(1)} КБ`})
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = "";
                          }}
                          className="text-gray-500 hover:text-red-400 ml-2"
                        >
                          <Icon name="X" size={18} />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <Icon name="Upload" size={36} className="mx-auto text-gray-500 mb-2" />
                        <p className="text-gray-400">
                          {mode === "archive"
                            ? "Нажмите для загрузки ZIP-архива (до 50 МБ)"
                            : "Нажмите для загрузки файла (до 1 МБ)"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Модель
                </label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="bg-gray-800 border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODELS.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  Цена за 1M токенов: вход / выход
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {mode === "chat" ? "Вопрос" : "Что нужно сделать?"}
                </label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={
                    mode === "chat"
                      ? "Задайте вопрос..."
                      : "Опишите, что нужно изменить, добавить или отредактировать..."
                  }
                  className="bg-gray-800 border-gray-600 min-h-[120px] resize-y"
                />
              </div>

              <Button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="w-full bg-purple-600 hover:bg-purple-700"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Icon name="Loader2" size={20} className="mr-2 animate-spin" />
                    Обрабатываю... не закрывайте страницу
                  </>
                ) : (
                  <>
                    <Icon name="Sparkles" size={20} className="mr-2" />
                    {mode === "chat" ? "Спросить" : "Отправить в AI"}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {response && (
            <Card className="bg-gray-900 border-gray-700">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon name="MessageSquare" size={20} className="text-purple-400" />
                    <h3 className="font-medium">Ответ модели</h3>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(response);
                      toast.success("Скопировано!");
                    }}
                    className="text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <Icon name="Copy" size={18} />
                  </button>
                </div>
                <pre className="bg-gray-800 rounded-lg p-4 text-sm text-gray-300 whitespace-pre-wrap overflow-x-auto max-h-[600px] overflow-y-auto">
                  {response}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}