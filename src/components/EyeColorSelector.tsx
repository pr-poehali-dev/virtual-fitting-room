import { useState, useRef, useEffect } from "react";
import Icon from "@/components/ui/icon";

interface EyeColorOption {
  label: string;
  value: string;
  imagePath: string;
}

interface EyeColorSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  options: Record<string, string>; // Russian → English mapping
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

  // Convert options to array with image paths
  const colorOptions: EyeColorOption[] = Object.entries(options).map(
    ([ru, en]) => ({
      label: ru,
      value: en,
      imagePath: `/images/eyes-colors/${en.replace(/ /g, "-")}.jpg`,
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

  // Handle image error - show gray placeholder
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement;
    target.style.display = "none";
    const placeholder = target.nextElementSibling as HTMLDivElement;
    if (placeholder) {
      placeholder.style.display = "block";
    }
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
              <div className="w-10 h-10 flex-shrink-0 rounded overflow-hidden bg-muted relative">
                <img
                  src={selectedOption.imagePath}
                  alt={selectedOption.label}
                  className="w-full h-full object-cover"
                  onError={handleImageError}
                />
                <div
                  className="w-full h-full bg-muted hidden"
                  style={{ display: "none" }}
                />
              </div>
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
                  <div className="w-10 h-10 flex-shrink-0 rounded overflow-hidden bg-muted relative">
                    <img
                      src={option.imagePath}
                      alt={option.label}
                      className="w-full h-full object-cover"
                      onError={handleImageError}
                    />
                    <div
                      className="w-full h-full bg-muted hidden"
                      style={{ display: "none" }}
                    />
                  </div>
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
