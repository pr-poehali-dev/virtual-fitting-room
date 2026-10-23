import { Input } from "@/components/ui/input";
import Icon from "@/components/ui/icon";
import SelectField from "./SelectField";
import ChipGroup from "./ChipGroup";
import {
  TRIP_SEASONS,
  DEPARTURE_WEATHER,
  TRANSPORTS,
  TRAVEL_TIMES,
  ACTIVITIES,
  LUGGAGE,
} from "@/lib/travelOptions";

export interface TripState {
  destination: string;
  tripSeason: string;
  tripDays: string;
  departureCity: string;
  departureWeather: string;
  transport: string;
  travelTime: string;
  activities: string[];
  customActivities: string;
  luggage: string;
}

export const EMPTY_TRIP: TripState = {
  destination: "",
  tripSeason: "",
  tripDays: "",
  departureCity: "",
  departureWeather: "",
  transport: "",
  travelTime: "",
  activities: [],
  customActivities: "",
  luggage: "",
};

interface Props {
  value: TripState;
  onChange: (next: TripState) => void;
}

const TripFields = ({ value, onChange }: Props) => {
  const set = <K extends keyof TripState>(key: K, v: TripState[K]) =>
    onChange({ ...value, [key]: v });

  const toggleActivity = (a: string) =>
    set(
      "activities",
      value.activities.includes(a)
        ? value.activities.filter((x) => x !== a)
        : [...value.activities, a],
    );

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-5">
      <p className="font-semibold flex items-center gap-2 text-lg">
        <Icon name="Plane" size={20} className="text-primary" />
        О поездке
      </p>

      <div className="grid md:grid-cols-3 gap-4">
        <div>
          <p className="font-medium mb-2">
            Куда едете <span className="text-destructive">*</span>
          </p>
          <Input
            placeholder="Например, Стамбул"
            value={value.destination}
            onChange={(e) => set("destination", e.target.value)}
            maxLength={120}
          />
        </div>
        <SelectField
          label="Когда"
          value={value.tripSeason}
          onChange={(v) => set("tripSeason", v)}
          options={TRIP_SEASONS}
          placeholder="Месяц поездки"
          required
        />
        <div>
          <p className="font-medium mb-2">
            Сколько дней <span className="text-destructive">*</span>
          </p>
          <Input
            type="number"
            min={1}
            max={60}
            placeholder="Например, 7"
            value={value.tripDays}
            onChange={(e) => set("tripDays", e.target.value)}
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <p className="font-medium mb-2">Откуда выезжаете</p>
          <Input
            placeholder="Например, Москва"
            value={value.departureCity}
            onChange={(e) => set("departureCity", e.target.value)}
            maxLength={120}
          />
        </div>
        <SelectField
          label="Погода там сейчас"
          value={value.departureWeather}
          onChange={(v) => set("departureWeather", v)}
          options={DEPARTURE_WEATHER}
        />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <SelectField
          label="Как добираетесь"
          value={value.transport}
          onChange={(v) => set("transport", v)}
          options={TRANSPORTS}
        />
        <SelectField
          label="Сколько в дороге"
          value={value.travelTime}
          onChange={(v) => set("travelTime", v)}
          options={TRAVEL_TIMES}
        />
        <SelectField
          label="Багаж"
          value={value.luggage}
          onChange={(v) => set("luggage", v)}
          options={LUGGAGE}
        />
      </div>

      <div>
        <ChipGroup
          title="Чем будете заниматься"
          hint="можно несколько"
          options={ACTIVITIES}
          selected={value.activities}
          onToggle={toggleActivity}
        />
        <Input
          className="mt-2"
          placeholder="Свой вариант (через запятую)"
          value={value.customActivities}
          onChange={(e) => set("customActivities", e.target.value)}
        />
      </div>
    </div>
  );
};

export default TripFields;
