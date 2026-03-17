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

const MODELS = [
  { id: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4" },
  { id: "anthropic/claude-opus-4", label: "Claude Opus 4" },
];

const AI_EDITOR_API = "https://functions.poehali.dev/5289d2a6-e800-484c-9394-e26388888d13";

export default function AiEditor() {
  const { user, isLoading } = useAuth();
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

    if (!selected.name.endsWith(".zip")) {
      toast.error("Загрузите ZIP-архив");
      return;
    }

    if (selected.size > 50 * 1024 * 1024) {
      toast.error("Максимальный размер архива — 50 МБ");
      return;
    }

    setFile(selected);
    setResponse("");
  };

  const handleSubmit = async () => {
    if (!file) {
      toast.error("Загрузите ZIP-архив");
      return;
    }
    if (!prompt.trim()) {
      toast.error("Напишите промпт");
      return;
    }

    if (!AI_EDITOR_API) {
      toast.error("API ещё не подключено");
      return;
    }

    setIsProcessing(true);
    setResponse("");

    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch(AI_EDITOR_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          archive_base64: base64,
          prompt: prompt.trim(),
          model,
          filename: file.name,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Ошибка обработки");
      }

      setResponse(data.ai_response || "");

      if (data.result_archive_base64) {
        const byteCharacters = atob(data.result_archive_base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/zip" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `edited_${file.name}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Архив скачан!");
      } else {
        toast.info("Модель не вернула файлы. Ответ отображён ниже.");
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Ошибка при обработке";
      toast.error(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Icon name="Wand2" size={28} className="text-purple-400" />
          <h1 className="text-2xl font-bold">AI-редактор кода</h1>
        </div>

        <div className="space-y-6">
          <Card className="bg-gray-900 border-gray-700">
            <CardContent className="pt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  ZIP-архив с проектом
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-purple-500 transition-colors"
                >
                  {file ? (
                    <div className="flex items-center justify-center gap-3">
                      <Icon name="FileArchive" size={24} className="text-purple-400" />
                      <span className="text-gray-200">{file.name}</span>
                      <span className="text-gray-500 text-sm">
                        ({(file.size / 1024 / 1024).toFixed(1)} МБ)
                      </span>
                    </div>
                  ) : (
                    <div>
                      <Icon name="Upload" size={40} className="mx-auto text-gray-500 mb-3" />
                      <p className="text-gray-400">Нажмите для загрузки ZIP-архива</p>
                      <p className="text-gray-600 text-sm mt-1">Максимум 50 МБ</p>
                    </div>
                  )}
                </div>
              </div>

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
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Что нужно сделать?
                </label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Опишите, что нужно изменить, добавить или отредактировать в проекте..."
                  className="bg-gray-800 border-gray-600 min-h-[120px] resize-y"
                />
              </div>

              <Button
                onClick={handleSubmit}
                disabled={isProcessing || !file || !prompt.trim()}
                className="w-full bg-purple-600 hover:bg-purple-700"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Icon name="Loader2" size={20} className="mr-2 animate-spin" />
                    Обрабатываю...
                  </>
                ) : (
                  <>
                    <Icon name="Sparkles" size={20} className="mr-2" />
                    Отправить в AI
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {response && (
            <Card className="bg-gray-900 border-gray-700">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-3">
                  <Icon name="MessageSquare" size={20} className="text-purple-400" />
                  <h3 className="font-medium">Ответ модели</h3>
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