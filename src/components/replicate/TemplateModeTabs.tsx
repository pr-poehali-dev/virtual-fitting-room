import { cn } from "@/lib/utils";

export type TemplateMode = "standard" | "capsule" | "lookbook_grid";

interface TemplateModeTabsProps {
  activeMode: TemplateMode;
  onModeChange: (mode: TemplateMode) => void;
  disabled?: boolean;
}

function StandardIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className={cn("w-10 h-10", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="8"
        y="4"
        width="32"
        height="40"
        rx="3"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <circle cx="24" cy="16" r="4" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path
        d="M16 38 C16 28, 32 28, 32 38"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <line x1="18" y1="24" x2="22" y2="30" stroke="currentColor" strokeWidth="1.5" />
      <line x1="30" y1="24" x2="26" y2="30" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function CapsuleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 48"
      fill="none"
      className={cn("w-12 h-10", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="2"
        y="2"
        width="26"
        height="44"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <circle cx="15" cy="14" r="3" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path
        d="M9 38 C9 30, 21 30, 21 38"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
      />
      <rect x="34" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <rect x="50" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <rect x="34" y="18" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <rect x="50" y="18" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <rect x="34" y="34" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <rect x="50" y="34" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

function GridIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 52 48"
      fill="none"
      className={cn("w-11 h-10", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="2" y="2" width="22" height="20" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <rect x="28" y="2" width="22" height="20" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <rect x="2" y="26" width="22" height="20" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <rect x="28" y="26" width="22" height="20" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="13" cy="8" r="2" stroke="currentColor" strokeWidth="1" fill="none" />
      <path d="M9 18 C9 14, 17 14, 17 18" stroke="currentColor" strokeWidth="1" fill="none" />
      <circle cx="39" cy="8" r="2" stroke="currentColor" strokeWidth="1" fill="none" />
      <path d="M35 18 C35 14, 43 14, 43 18" stroke="currentColor" strokeWidth="1" fill="none" />
      <circle cx="13" cy="32" r="2" stroke="currentColor" strokeWidth="1" fill="none" />
      <path d="M9 42 C9 38, 17 38, 17 42" stroke="currentColor" strokeWidth="1" fill="none" />
      <circle cx="39" cy="32" r="2" stroke="currentColor" strokeWidth="1" fill="none" />
      <path d="M35 42 C35 38, 43 38, 43 42" stroke="currentColor" strokeWidth="1" fill="none" />
    </svg>
  );
}

const modes = [
  {
    id: "standard" as TemplateMode,
    label: "Примерка",
    description: "1 образ",
    Icon: StandardIcon,
  },
  {
    id: "capsule" as TemplateMode,
    label: "Капсула",
    description: "Образ + гардероб",
    Icon: CapsuleIcon,
  },
  {
    id: "lookbook_grid" as TemplateMode,
    label: "Лукбук-сетка",
    description: "4 или 8 образов",
    Icon: GridIcon,
  },
];

export default function TemplateModeTabs({
  activeMode,
  onModeChange,
  disabled,
}: TemplateModeTabsProps) {
  return (
    <div className="flex justify-center gap-3 mb-8">
      {modes.map((mode) => (
        <button
          key={mode.id}
          onClick={() => onModeChange(mode.id)}
          disabled={disabled}
          className={cn(
            "flex flex-col items-center gap-1.5 px-5 py-3 rounded-xl border-2 transition-all duration-200 min-w-[120px]",
            activeMode === mode.id
              ? "border-purple-500 bg-purple-50 text-purple-700 shadow-md"
              : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <mode.Icon
            className={cn(
              activeMode === mode.id ? "text-purple-600" : "text-gray-400"
            )}
          />
          <span className="text-sm font-semibold">{mode.label}</span>
          <span className="text-[11px] opacity-70">{mode.description}</span>
        </button>
      ))}
    </div>
  );
}
