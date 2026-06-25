import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";

const FREEGEN_START_API =
  "https://functions.poehali.dev/093c98ba-e711-4c78-b328-a7494005df42";
const DB_QUERY_API =
  "https://functions.poehali.dev/59a0379b-a4b5-4cec-b2d2-884439f64df9";

export const MODEL_COST = 50;
export const TRYON_COST = 50;

export interface UserModel {
  id: number;
  image_url: string;
  gender?: string;
  age?: string;
  height?: string;
  body_type?: string;
  created_at?: string;
}

interface CreateModelDialogProps {
  open: boolean;
  onClose: () => void;
  onModelReady: (imageUrl: string) => void;
  onGenerationStarted: (taskId: string) => void;
  balance: number;
  unlimited: boolean;
}

interface ModelForm {
  gender: string;
  age: string;
  height: string;
  body_type: string;
  hair_color: string;
  hair_length: string;
  eye_color: string;
  colortype: string;
  kibbe: string;
}

const EMPTY_FORM: ModelForm = {
  gender: "",
  age: "",
  height: "",
  body_type: "",
  hair_color: "",
  hair_length: "",
  eye_color: "",
  colortype: "",
  kibbe: "",
};

const BODY_TYPES = [
  { value: "slim", label: "Худощавое" },
  { value: "athletic", label: "Спортивное" },
  { value: "average", label: "Среднее" },
  { value: "curvy", label: "С формами" },
  { value: "plus", label: "Плюс-сайз" },
];

const HAIR_LENGTHS = [
  { value: "short", label: "Короткие" },
  { value: "medium", label: "Средние" },
  { value: "long", label: "Длинные" },
];

const COLORTYPES = [
  { value: "spring", label: "Весна" },
  { value: "summer", label: "Лето" },
  { value: "autumn", label: "Осень" },
  { value: "winter", label: "Зима" },
];

const KIBBE_TYPES = [
  "Dramatic",
  "Soft Dramatic",
  "Flamboyant Natural",
  "Soft Natural",
  "Flamboyant Gamine",
  "Soft Gamine",
  "Theatrical Romantic",
  "Romantic",
  "Classic",
];

export default function CreateModelDialog({
  open,
  onClose,
  onModelReady,
  onGenerationStarted,
  balance,
  unlimited,
}: CreateModelDialogProps) {
  const [form, setForm] = useState<ModelForm>(EMPTY_FORM);
  const [isGenerating, setIsGenerating] = useState(false);
  const [models, setModels] = useState<UserModel[]>([]);

  const getToken = () => localStorage.getItem("session_token");

  const fetchModels = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(DB_QUERY_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": token,
        },
        credentials: "include",
        body: JSON.stringify({
          table: "user_models",
          action: "select",
          order_by: "created_at DESC",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setModels(Array.isArray(data?.data) ? data.data : []);
      }
    } catch (e) {
      console.error("[CreateModel] fetchModels error", e);
    }
  };

  useEffect(() => {
    if (open) {
      fetchModels();
    } else {
      setForm(EMPTY_FORM);
      setIsGenerating(false);
    }
  }, [open]);

  const hasModels = models.length > 0;
  const canGenerate =
    unlimited || hasModels
      ? unlimited || balance >= MODEL_COST
      : balance >= MODEL_COST + TRYON_COST;

  const update = (key: keyof ModelForm, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleGenerate = async () => {
    if (!form.gender || !form.age || !form.height || !form.body_type) {
      toast.error("Заполните обязательные поля: пол, возраст, рост, телосложение");
      return;
    }
    if (!canGenerate) {
      toast.error(
        `Нужно ${MODEL_COST + TRYON_COST}₽: ${MODEL_COST} на модель + ${TRYON_COST} на примерку`,
      );
      return;
    }
    const token = getToken();
    if (!token) {
      toast.error("Требуется авторизация");
      return;
    }
    setIsGenerating(true);
    try {
      const res = await fetch(FREEGEN_START_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": token,
        },
        credentials: "include",
        body: JSON.stringify({
          task_type: "model",
          model_params: form,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setIsGenerating(false);
        toast.error(data.message || data.error || "Ошибка запуска генерации");
        return;
      }
      // Закрываем окно — лоадер и опрос статуса теперь в родителе
      setIsGenerating(false);
      onGenerationStarted(data.task_id);
      onClose();
      toast.info("Генерируем модель, это займёт до минуты");
    } catch (e) {
      console.error("[CreateModel] generate error", e);
      setIsGenerating(false);
      toast.error("Ошибка соединения");
    }
  };

  const handleSelectModel = (model: UserModel) => {
    onModelReady(model.image_url);
    onClose();
    toast.success("Модель выбрана");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Создать модель по описанию</DialogTitle>
          <DialogDescription>
            Чем подробнее заполните — тем точнее будет результат
          </DialogDescription>
        </DialogHeader>

        {hasModels && (
          <div className="mb-2">
            <Label className="text-sm font-medium mb-2 block">
              Мои модели — выберите готовую без оплаты
            </Label>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {models.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleSelectModel(m)}
                  className="flex-shrink-0 w-20 h-28 rounded-lg overflow-hidden border-2 border-transparent hover:border-primary transition-colors"
                  title="Выбрать эту модель"
                >
                  <img
                    src={m.image_url}
                    alt="Модель"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
            <div className="text-center text-xs text-muted-foreground my-3">
              или создайте новую ниже
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="mb-1 block">
              Пол <span className="text-red-500">*</span>
            </Label>
            <Select
              value={form.gender}
              onValueChange={(v) => update("gender", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="female">Женский</SelectItem>
                <SelectItem value="male">Мужской</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1 block">
              Возраст <span className="text-red-500">*</span>
            </Label>
            <Input
              type="number"
              placeholder="например, 25"
              value={form.age}
              onChange={(e) => update("age", e.target.value)}
            />
          </div>

          <div>
            <Label className="mb-1 block">
              Рост, см <span className="text-red-500">*</span>
            </Label>
            <Input
              type="number"
              placeholder="например, 170"
              value={form.height}
              onChange={(e) => update("height", e.target.value)}
            />
          </div>

          <div>
            <Label className="mb-1 block">
              Телосложение <span className="text-red-500">*</span>
            </Label>
            <Select
              value={form.body_type}
              onValueChange={(v) => update("body_type", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите" />
              </SelectTrigger>
              <SelectContent>
                {BODY_TYPES.map((b) => (
                  <SelectItem key={b.value} value={b.value}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1 block">Цвет волос</Label>
            <Input
              placeholder="например, русые"
              value={form.hair_color}
              onChange={(e) => update("hair_color", e.target.value)}
            />
          </div>

          <div>
            <Label className="mb-1 block">Длина волос</Label>
            <Select
              value={form.hair_length}
              onValueChange={(v) => update("hair_length", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Не важно" />
              </SelectTrigger>
              <SelectContent>
                {HAIR_LENGTHS.map((h) => (
                  <SelectItem key={h.value} value={h.value}>
                    {h.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1 block">Цвет глаз</Label>
            <Input
              placeholder="например, карие"
              value={form.eye_color}
              onChange={(e) => update("eye_color", e.target.value)}
            />
          </div>

          <div>
            <Label className="mb-1 block">Цветотип</Label>
            <Select
              value={form.colortype}
              onValueChange={(v) => update("colortype", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Не важно" />
              </SelectTrigger>
              <SelectContent>
                {COLORTYPES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {form.gender === "female" && (
            <div className="col-span-2">
              <Label className="mb-1 block">Типаж по Кибби</Label>
              <Select
                value={form.kibbe}
                onValueChange={(v) => update("kibbe", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Не важно" />
                </SelectTrigger>
                <SelectContent>
                  {KIBBE_TYPES.map((k) => (
                    <SelectItem key={k} value={k}>
                      {k}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="mt-4">
          {!canGenerate && (
            <p className="text-xs text-orange-600 mb-2 text-center">
              Для создания модели нужно {MODEL_COST + TRYON_COST}₽ на балансе:{" "}
              {MODEL_COST} на модель + {TRYON_COST} на примерку
            </p>
          )}
          <Button
            className="w-full"
            onClick={handleGenerate}
            disabled={isGenerating || !canGenerate}
          >
            {isGenerating ? (
              <>
                <Icon name="Loader2" className="mr-2 animate-spin" size={18} />
                Запуск...
              </>
            ) : (
              <>
                <Icon name="Sparkles" className="mr-2" size={18} />
                Сгенерировать модель ({unlimited ? "0" : MODEL_COST}₽)
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}