import { Input } from "@/components/ui/input";

interface Props {
  title: string;
  hint?: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  custom?: string;
  onCustomChange?: (value: string) => void;
  customPlaceholder?: string;
  optional?: boolean;
}

export default function TagPicker({
  title,
  hint,
  options,
  selected,
  onToggle,
  custom,
  onCustomChange,
  customPlaceholder = "Свой вариант (через запятую)",
  optional = true,
}: Props) {
  return (
    <div>
      <p className="font-medium mb-2">
        {title}{" "}
        {optional && (
          <span className="text-muted-foreground text-xs">(необязательно)</span>
        )}
      </p>
      {hint && <p className="text-xs text-muted-foreground mb-2">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            className={`rounded-full border px-3 py-1.5 text-sm transition-all ${
              selected.includes(o)
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:border-primary/40"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
      {onCustomChange && (
        <Input
          className="mt-2"
          placeholder={customPlaceholder}
          value={custom || ""}
          onChange={(e) => onCustomChange(e.target.value)}
        />
      )}
    </div>
  );
}
