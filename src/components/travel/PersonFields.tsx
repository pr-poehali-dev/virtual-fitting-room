import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import SelectField from "./SelectField";
import ChipGroup from "./ChipGroup";
import {
  GENDERS,
  KIBBE_TYPES,
  ARCHETYPES,
  COLORTYPES,
  HAIR_LENGTHS,
  TAGS,
  COLORS,
  FABRICS,
  PATTERNS,
  SKIRT_LENGTHS,
  MAX_ARCHETYPES,
  MAX_COLORTYPES,
} from "@/lib/travelOptions";

export interface PersonState {
  gender: string;
  height: string;
  kibbe: string;
  archetypes: string[];
  colortypes: string[];
  hairLength: string;
  hairColor: string;
  eyeColor: string;
  tags: string[];
  favoriteColors: string[];
  dislikedColors: string[];
  favoriteFabrics: string[];
  dislikedFabrics: string[];
  favoritePatterns: string[];
  dislikedPatterns: string[];
  skirtLength: string;
  styleAge: string;
  comment: string;
}

export const EMPTY_PERSON: PersonState = {
  gender: "",
  height: "",
  kibbe: "",
  archetypes: [],
  colortypes: [],
  hairLength: "",
  hairColor: "",
  eyeColor: "",
  tags: [],
  favoriteColors: [],
  dislikedColors: [],
  favoriteFabrics: [],
  dislikedFabrics: [],
  favoritePatterns: [],
  dislikedPatterns: [],
  skirtLength: "",
  styleAge: "",
  comment: "",
};

type ListKey =
  | "archetypes"
  | "colortypes"
  | "tags"
  | "favoriteColors"
  | "dislikedColors"
  | "favoriteFabrics"
  | "dislikedFabrics"
  | "favoritePatterns"
  | "dislikedPatterns";

interface Props {
  value: PersonState;
  onChange: (next: PersonState) => void;
}

const PersonFields = ({ value, onChange }: Props) => {
  const set = <K extends keyof PersonState>(key: K, v: PersonState[K]) =>
    onChange({ ...value, [key]: v });

  const toggle = (key: ListKey, item: string, max?: number) => {
    const list = value[key];
    if (list.includes(item)) {
      set(key, list.filter((x) => x !== item));
      return;
    }
    if (max && list.length >= max) {
      toast.error(`Можно выбрать не более ${max}`);
      return;
    }
    set(key, [...list, item]);
  };

  return (
    <div className="space-y-6">
      <p className="font-semibold flex items-center gap-2 text-lg">
        <Icon name="UserRound" size={20} className="text-primary" />
        О себе
      </p>

      <div className="grid md:grid-cols-3 gap-4">
        <SelectField
          label="Пол"
          value={value.gender}
          onChange={(v) => set("gender", v)}
          options={GENDERS}
          placeholder="Выберите пол"
          required
        />
        <div>
          <p className="font-medium mb-2">Рост, см</p>
          <Input
            type="number"
            min={100}
            max={250}
            placeholder="Например, 168"
            value={value.height}
            onChange={(e) => set("height", e.target.value)}
          />
        </div>
        <SelectField
          label="Типаж по Кибби"
          value={value.kibbe}
          onChange={(v) => set("kibbe", v)}
          options={KIBBE_TYPES}
        />
      </div>

      <ChipGroup
        title="Архетип(ы) по Юнгу"
        hint="до 4"
        options={ARCHETYPES}
        selected={value.archetypes}
        onToggle={(v) => toggle("archetypes", v, MAX_ARCHETYPES)}
      />
      <ChipGroup
        title="Цветотип внешности"
        hint="до 2"
        options={COLORTYPES}
        selected={value.colortypes}
        onToggle={(v) => toggle("colortypes", v, MAX_COLORTYPES)}
      />

      <div className="grid md:grid-cols-3 gap-4">
        <SelectField
          label="Длина волос"
          value={value.hairLength}
          onChange={(v) => set("hairLength", v)}
          options={HAIR_LENGTHS}
        />
        <div>
          <p className="font-medium mb-2">Цвет волос</p>
          <Input
            placeholder="Например, русый"
            value={value.hairColor}
            onChange={(e) => set("hairColor", e.target.value)}
          />
        </div>
        <div>
          <p className="font-medium mb-2">Цвет глаз</p>
          <Input
            placeholder="Например, зелёные"
            value={value.eyeColor}
            onChange={(e) => set("eyeColor", e.target.value)}
          />
        </div>
      </div>

      <ChipGroup
        title="Желаемые акценты"
        options={TAGS}
        selected={value.tags}
        onToggle={(v) => toggle("tags", v)}
      />

      <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
        <ChipGroup
          title="Цвета, которые нравятся"
          options={COLORS}
          selected={value.favoriteColors}
          onToggle={(v) => toggle("favoriteColors", v)}
        />
        <ChipGroup
          title="Цвета, которые не нравятся"
          options={COLORS}
          selected={value.dislikedColors}
          onToggle={(v) => toggle("dislikedColors", v)}
        />
        <ChipGroup
          title="Ткани, которые нравятся"
          options={FABRICS}
          selected={value.favoriteFabrics}
          onToggle={(v) => toggle("favoriteFabrics", v)}
        />
        <ChipGroup
          title="Ткани, которые не нравятся"
          options={FABRICS}
          selected={value.dislikedFabrics}
          onToggle={(v) => toggle("dislikedFabrics", v)}
        />
        <ChipGroup
          title="Орнаменты, которые нравятся"
          options={PATTERNS}
          selected={value.favoritePatterns}
          onToggle={(v) => toggle("favoritePatterns", v)}
        />
        <ChipGroup
          title="Орнаменты, которые не нравятся"
          options={PATTERNS}
          selected={value.dislikedPatterns}
          onToggle={(v) => toggle("dislikedPatterns", v)}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {value.gender === "Женский" && (
          <SelectField
            label="Длина юбок"
            value={value.skirtLength}
            onChange={(v) => set("skirtLength", v)}
            options={SKIRT_LENGTHS}
          />
        )}
        <div>
          <p className="font-medium mb-2">Примерный возраст для образов</p>
          <Input
            type="number"
            min={1}
            max={120}
            placeholder="Например, 30"
            value={value.styleAge}
            onChange={(e) => set("styleAge", e.target.value)}
          />
        </div>
      </div>

      <div>
        <p className="font-medium mb-2">Комментарий</p>
        <Textarea
          placeholder="Особые пожелания: что любите носить, что важно взять, планы на поездку..."
          value={value.comment}
          onChange={(e) => set("comment", e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
};

export default PersonFields;
