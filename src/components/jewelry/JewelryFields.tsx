import { Input } from "@/components/ui/input";
import Icon from "@/components/ui/icon";
import SelectField from "@/components/travel/SelectField";
import ChipGroup from "@/components/travel/ChipGroup";
import {
  JEWELRY_OCCASIONS,
  METALS,
  STONES,
  JEWELRY_TYPES,
  EARS,
  BUDGETS,
} from "@/lib/travelOptions";

export interface JewelryState {
  occasions: string[];
  customOccasions: string;
  metal: string;
  stones: string[];
  jewelryTypes: string[];
  earsPierced: string;
  budget: string;
  dislikes: string;
}

export const EMPTY_JEWELRY: JewelryState = {
  occasions: [],
  customOccasions: "",
  metal: "",
  stones: [],
  jewelryTypes: [],
  earsPierced: "",
  budget: "",
  dislikes: "",
};

type ListKey = "occasions" | "stones" | "jewelryTypes";

interface Props {
  value: JewelryState;
  onChange: (next: JewelryState) => void;
}

const MAX_OCCASIONS = 3;

const JewelryFields = ({ value, onChange }: Props) => {
  const set = <K extends keyof JewelryState>(key: K, v: JewelryState[K]) =>
    onChange({ ...value, [key]: v });

  const toggle = (key: ListKey, item: string, max?: number) => {
    const list = value[key];
    if (list.includes(item)) {
      set(key, list.filter((x) => x !== item));
      return;
    }
    if (max && list.length >= max) return;
    set(key, [...list, item]);
  };

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-5">
      <p className="font-semibold flex items-center gap-2 text-lg">
        <Icon name="Gem" size={20} className="text-primary" />
        Об украшениях
      </p>

      <div>
        <ChipGroup
          title="Поводы для 3 наборов"
          hint="до 3; если не выбрать — повседневный, деловой, вечерний"
          options={JEWELRY_OCCASIONS}
          selected={value.occasions}
          onToggle={(v) => toggle("occasions", v, MAX_OCCASIONS)}
        />
        <Input
          className="mt-2"
          placeholder="Свой повод (через запятую)"
          value={value.customOccasions}
          onChange={(e) => set("customOccasions", e.target.value)}
        />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <SelectField
          label="Любимый металл"
          value={value.metal}
          onChange={(v) => set("metal", v)}
          options={METALS}
        />
        <SelectField
          label="Уши проколоты"
          value={value.earsPierced}
          onChange={(v) => set("earsPierced", v)}
          options={EARS}
        />
        <SelectField
          label="Бюджет"
          value={value.budget}
          onChange={(v) => set("budget", v)}
          options={BUDGETS}
        />
      </div>

      <ChipGroup
        title="Камни"
        options={STONES}
        selected={value.stones}
        onToggle={(v) => toggle("stones", v)}
      />
      <ChipGroup
        title="Что носите"
        options={JEWELRY_TYPES}
        selected={value.jewelryTypes}
        onToggle={(v) => toggle("jewelryTypes", v)}
      />

      <div>
        <p className="font-medium mb-2">Чего не носите или не любите</p>
        <Input
          placeholder="Например: крупные кольца, длинные серьги"
          value={value.dislikes}
          onChange={(e) => set("dislikes", e.target.value)}
          maxLength={300}
        />
      </div>
    </div>
  );
};

export default JewelryFields;
