import { useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";

interface EyeColorOption {
  label: string;
  value: string;
  gradient: [string, string]; // [outer, inner]
}

interface EyeColorSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  options: Record<string, string>; // Russian → English mapping
}

// Color mapping for eye colors (English value → [outer, inner] gradient colors)
const eyeColorMap: Record<string, [string, string]> = {
  // Turquoise / Бирюзовые
  "turquoise": ["#40E0D0", "#40E0D0"],
  "turquoise blue": ["#00CED1", "#00CED1"],

  // Blue / Голубые
  "blue": ["#4b6e8e", "#5995b7"],
  "cyan": ["#4ea0aa", "#57aab4"],
  "soft blue": ["#87CEEB", "#87CEEB"],
  "light blue": ["#7597b1", "#a7ccdd"],
  "warm blue": ["#6495ED", "#6495ED"],
  "cool blue": ["#4682B4", "#4682B4"],
  "bright blue": ["#1f6c8f", "#6fc6f0"],

  // Green / Зелёные
  "green": ["#416267", "#79b96f"],
  "emerald green": ["#1e6851", "#3a9b7c"],
  "light green": ["#8e975e", "#c4dca0"],
  "dark green": ["#006400", "#006400"],
  "warm green": ["#6B8E23", "#6B8E23"],
  "bright green": ["#00FF00", "#00FF00"],

  // Golden / Золотистые
  "golden": ["#FFD700", "#FFD700"],
  "golden brown": ["#41200d", "#652905"],

  // Brown / Карие
  "brown": ["#8B4513", "#8B4513"],
  "light brown": ["#a7795f", "#bd946f"],
  "dark brown": ["#1c1912", "#372920"],
  "cool brown": ["#704214", "#704214"],
  "bright brown": ["#A0522D", "#A0522D"],

  // Brown-Green / Коричнево-зелёные
  "brown-green": ["#6B5D3D", "#6B5D3D"],
  "bright brown-green": ["#7A6C4F", "#7A6C4F"],

  // Brown-Black / Коричнево-чёрные
  "brown-black": ["#3a2220", "#241a11"],

  // Azure / Лазурные
  "azure": ["#4e697c", "#6da1aa"],
  "light turquoise": ["#AFEEEE", "#AFEEEE"],

  // Jade / Нефритовые
  "jade": ["#00A86B", "#00A86B"],

  // Hazel / Ореховые
  "hazel": ["#82935a", "#9f8c5a"],
  "icy hazel": ["#C19A6B", "#C19A6B"],
  "light hazel": ["#5f4a39", "#a97c5b"],
  "dark hazel": ["#50341e", "#6a4f32"],

  // Olive / Оливковые
  "olive green": ["#6e5431", "#765d35"],
  "dark olive": ["#434a3a", "#6b6b3a"],

  // Gray-Blue / Серо-голубые
  "gray-blue": ["#6699CC", "#6699CC"],
  "soft gray-blue": ["#8FA8C0", "#8FA8C0"],
  "bright gray-blue": ["#4A90C9", "#4A90C9"],

  // Gray-Green / Серо-зелёные
  "gray-green": ["#8A9A5B", "#8A9A5B"],
  "soft gray-green": ["#A2AC8A", "#A2AC8A"],

  // Gray-Brown / Серо-карие
  "light grey brown": ["#3e4f56", "#707a6c"],

  // Gray / Серые
  "gray": ["#425363", "#798593"],
  "soft gray": ["#A9A9A9", "#A9A9A9"],
  "light grey": ["#415465", "#8494a1"],
  "dark grey": ["#696969", "#696969"],

  // Blue-Green / Сине-зелёные
  "blue-green": ["#0D98BA", "#0D98BA"],
  "light blue-green": ["#66CDAA", "#66CDAA"],
  "bright blue-green": ["#00CED1", "#00CED1"],

  // Blue-Gray / Сине-серые
  "blue-gray": ["#6699CC", "#6699CC"],

  // Cocoa / Цвета какао
  "cocoa": ["#6F4E37", "#6F4E37"],

  // Black-Brown / Чёрно-карие
  "black-brown": ["#3B2F2F", "#3B2F2F"],

  // Black / Чёрные
  "black": ["#1e2629", "#2a2924"],

  // Chocolate / Шоколадные
  "chocolate": ["#7B3F00", "#7B3F00"],

  // Topaz / Топазовые
  "topaz": ["#FFCC99", "#FFCC99"],

  // Amber / Янтарные
  "amber": ["#4f2203", "#986334"],

  // Other / Другие
  "muted": ["#B0B0B0", "#B0B0B0"],
  "dark": ["#2F2F2F", "#2F2F2F"],
  "cool": ["#708090", "#708090"],
};

// Eye icon component with radial gradient
function EyeIcon({ gradient }: { gradient: [string, string] }) {
  const [outerColor, innerColor] = gradient;
  return (
    <div
      className="w-[30px] h-[30px] rounded-full flex items-center justify-center relative flex-shrink-0"
      style={{
        background: `radial-gradient(circle, ${innerColor} 0%, ${outerColor} 80%)`
      }}
    >
      {/* Pupil (black circle) */}
      <div className="w-[10px] h-[10px] rounded-full bg-black relative">
        {/* Highlight (white circle, offset from center) */}
        <div
          className="w-[4px] h-[4px] rounded-full bg-white absolute"
          style={{ top: "1px", left: "2px" }}
        />
      </div>
    </div>
  );
}

export default function EyeColorSelector({
  value,
  onChange,
  disabled = false,
  options,
}: EyeColorSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Convert options to array with gradients
  const colorOptions: EyeColorOption[] = Object.entries(options).map(
    ([ru, en]) => ({
      label: ru,
      value: en,
      gradient: eyeColorMap[en] || ["#999999", "#999999"], // Default gray if color not found
    })
  );

  // Filter options based on search
  const filteredOptions = colorOptions.filter((option) =>
    option.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get selected option
  const selectedOption = colorOptions.find((opt) => opt.value === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Selected value display */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {selectedOption ? (
            <>
              <EyeIcon gradient={selectedOption.gradient} />
              <span className="text-left truncate">{selectedOption.label}</span>
            </>
          ) : (
            <span className="text-muted-foreground">Выберите цвет глаз</span>
          )}
        </div>
        <Icon
          name={isOpen ? "ChevronUp" : "ChevronDown"}
          size={20}
          className="flex-shrink-0 text-muted-foreground"
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-background border border-input rounded-md shadow-lg max-h-80 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-border sticky top-0 bg-background">
            <div className="relative">
              <Icon
                name="Search"
                size={16}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                placeholder="Поиск..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-input rounded bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Options list */}
          <div className="overflow-y-auto max-h-64">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`w-full px-3 py-2 flex items-center gap-2 hover:bg-muted transition-colors text-left ${
                    value === option.value ? "bg-muted" : ""
                  }`}
                >
                  <EyeIcon gradient={option.gradient} />
                  <span className="flex-1">{option.label}</span>
                  {value === option.value && (
                    <Icon name="Check" size={16} className="text-primary" />
                  )}
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                Ничего не найдено
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}