interface ChipGroupProps {
  title: string;
  hint?: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}

const ChipGroup = ({ title, hint, options, selected, onToggle }: ChipGroupProps) => (
  <div>
    <p className="font-medium mb-2">
      {title}
      {hint && (
        <span className="text-muted-foreground text-xs"> ({hint})</span>
      )}
    </p>
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
  </div>
);

export default ChipGroup;
