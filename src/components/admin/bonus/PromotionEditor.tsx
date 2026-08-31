import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Icon from "@/components/ui/icon";

export interface Promotion {
  id?: string;
  code: string;
  title: string;
  description: string;
  trigger_type: string;
  min_amount: number;
  bonus_amount: number;
  expires_days: number | null;
  is_active: boolean;
  show_on_site: boolean;
  sort_order: number;
  ends_at?: string | null;
  granted_total?: number;
  granted_count?: number;
}

export const emptyPromotion: Promotion = {
  code: "",
  title: "",
  description: "",
  trigger_type: "topup",
  min_amount: 0,
  bonus_amount: 0,
  expires_days: 30,
  is_active: false,
  show_on_site: true,
  sort_order: 100,
};

interface Props {
  value: Promotion;
  onChange: (next: Promotion) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

export default function PromotionEditor({
  value,
  onChange,
  onSave,
  onCancel,
  isSaving,
}: Props) {
  const [neverExpires, setNeverExpires] = useState(value.expires_days === null);

  const set = (patch: Partial<Promotion>) => onChange({ ...value, ...patch });

  return (
    <div className="border rounded-xl p-5 bg-muted/30 space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <Label>Название акции</Label>
          <Input
            value={value.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="Пополнение от 500 ₽"
          />
        </div>
        <div>
          <Label>Короткий код</Label>
          <Input
            value={value.code}
            onChange={(e) =>
              set({ code: e.target.value.replace(/\s/g, "_").toLowerCase() })
            }
            placeholder="topup_500"
            disabled={Boolean(value.id)}
          />
        </div>
      </div>

      <div>
        <Label>Описание для страницы «Акции»</Label>
        <Textarea
          value={value.description}
          onChange={(e) => set({ description: e.target.value })}
          placeholder="Пополните счёт на 500 ₽ и получите 50 бонусных рублей сверху."
          rows={2}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <Label>За что начисляем</Label>
          <Select
            value={value.trigger_type}
            onValueChange={(v) => set({ trigger_type: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="registration">За регистрацию</SelectItem>
              <SelectItem value="topup">За пополнение</SelectItem>
              <SelectItem value="custom">Вручную / своё событие</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {value.trigger_type === "topup" && (
          <div>
            <Label>Пополнение от, ₽</Label>
            <Input
              type="number"
              value={value.min_amount}
              onChange={(e) => set({ min_amount: Number(e.target.value) })}
            />
          </div>
        )}

        <div>
          <Label>Бонусных рублей</Label>
          <Input
            type="number"
            value={value.bonus_amount}
            onChange={(e) => set({ bonus_amount: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Switch
              checked={!neverExpires}
              onCheckedChange={(on) => {
                setNeverExpires(!on);
                set({ expires_days: on ? 30 : null });
              }}
            />
            <Label className="cursor-pointer">Бонусы сгорают</Label>
          </div>
          {!neverExpires && (
            <Input
              type="number"
              value={value.expires_days ?? 30}
              onChange={(e) => set({ expires_days: Number(e.target.value) })}
              placeholder="30"
            />
          )}
          {!neverExpires && (
            <p className="text-xs text-muted-foreground">
              Через столько дней после начисления
            </p>
          )}
        </div>

        <div>
          <Label>Акция действует до</Label>
          <Input
            type="date"
            value={value.ends_at ? value.ends_at.slice(0, 10) : ""}
            onChange={(e) =>
              set({ ends_at: e.target.value ? e.target.value : null })
            }
          />
          <p className="text-xs text-muted-foreground mt-1">
            Пусто — бессрочно
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-6 pt-2">
        <div className="flex items-center gap-3">
          <Switch
            checked={value.is_active}
            onCheckedChange={(on) => set({ is_active: on })}
          />
          <Label className="cursor-pointer">Акция включена</Label>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            checked={value.show_on_site}
            onCheckedChange={(on) => set({ show_on_site: on })}
          />
          <Label className="cursor-pointer">Показывать на сайте</Label>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving ? (
            <Icon name="Loader2" size={16} className="animate-spin mr-2" />
          ) : (
            <Icon name="Check" size={16} className="mr-2" />
          )}
          Сохранить
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Отмена
        </Button>
      </div>
    </div>
  );
}
