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
      <circle cx="24" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M22 7 C20 5, 18 6, 19 8" stroke="currentColor" strokeWidth="1" fill="none" />
      <path d="M26 7 C28 5, 30 6, 29 8" stroke="currentColor" strokeWidth="1" fill="none" />
      <path d="M20 12 L18 16 L24 18 L30 16 L28 12" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M18 16 L14 38" stroke="currentColor" strokeWidth="1.5" />
      <path d="M30 16 L34 38" stroke="currentColor" strokeWidth="1.5" />
      <path d="M14 38 Q24 40, 34 38" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M24 18 L24 38" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" opacity="0.4" />
      <path d="M17 40 L16 46" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M31 40 L32 46" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <ellipse cx="15.5" cy="46.5" rx="2" ry="1" stroke="currentColor" strokeWidth="1" fill="none" />
      <ellipse cx="32.5" cy="46.5" rx="2" ry="1" stroke="currentColor" strokeWidth="1" fill="none" />
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
      <circle cx="13" cy="6" r="3" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path d="M11 5.5 C9.5 4, 8 5, 8.5 6.5" stroke="currentColor" strokeWidth="0.8" fill="none" />
      <path d="M15 5.5 C16.5 4, 18 5, 17.5 6.5" stroke="currentColor" strokeWidth="0.8" fill="none" />
      <path d="M9 9.5 L7.5 13 L13 14.5 L18.5 13 L17 9.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path d="M7.5 13 L4 34" stroke="currentColor" strokeWidth="1.2" />
      <path d="M18.5 13 L22 34" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4 34 Q13 36, 22 34" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path d="M7 36 L6 42" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M19 36 L20 42" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <ellipse cx="5.5" cy="42.5" rx="1.8" ry="0.8" stroke="currentColor" strokeWidth="0.8" fill="none" />
      <ellipse cx="20.5" cy="42.5" rx="1.8" ry="0.8" stroke="currentColor" strokeWidth="0.8" fill="none" />

      <rect x="30" y="2" width="14" height="13" rx="1.5" stroke="currentColor" strokeWidth="1" fill="none" />
      <path d="M34 5 L34 11 L40 11" stroke="currentColor" strokeWidth="0.9" fill="none" strokeLinecap="round" />
      <path d="M34 5 Q37 3, 40 5 L40 11" stroke="currentColor" strokeWidth="0.9" fill="none" />

      <rect x="48" y="2" width="14" height="13" rx="1.5" stroke="currentColor" strokeWidth="1" fill="none" />
      <path d="M52 6 L52 13" stroke="currentColor" strokeWidth="0.9" />
      <path d="M60 6 L60 13" stroke="currentColor" strokeWidth="0.9" />
      <path d="M52 6 Q56 4, 60 6" stroke="currentColor" strokeWidth="0.9" fill="none" />

      <rect x="30" y="18" width="14" height="13" rx="1.5" stroke="currentColor" strokeWidth="1" fill="none" />
      <path d="M35 21 L33 28 L37 29 L41 28 L39 21 Z" stroke="currentColor" strokeWidth="0.8" fill="none" />
      <path d="M35 21 Q37 19.5, 39 21" stroke="currentColor" strokeWidth="0.8" fill="none" />

      <rect x="48" y="18" width="14" height="13" rx="1.5" stroke="currentColor" strokeWidth="1" fill="none" />
      <path d="M53 24 L52 28 L55 29 L58 28 L57 24" stroke="currentColor" strokeWidth="0.8" fill="none" />
      <path d="M52 28 L50 27" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" />
      <path d="M58 28 L60 27" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" />

      <rect x="30" y="34" width="14" height="13" rx="1.5" stroke="currentColor" strokeWidth="1" fill="none" />
      <path d="M35 38 Q37 36, 39 38 L40 44 L34 44 Z" stroke="currentColor" strokeWidth="0.8" fill="none" />

      <rect x="48" y="34" width="14" height="13" rx="1.5" stroke="currentColor" strokeWidth="1" fill="none" />
      <path d="M53 40 Q55 38.5, 57 40 Q57.5 42, 55 43 Q52.5 42, 53 40" stroke="currentColor" strokeWidth="0.8" fill="none" />
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

      <circle cx="13" cy="6.5" r="2" stroke="currentColor" strokeWidth="0.9" fill="none" />
      <path d="M12 6 C11 5, 10 5.5, 10.5 6.5" stroke="currentColor" strokeWidth="0.6" fill="none" />
      <path d="M11 9 L10 11.5 L13 12.5 L16 11.5 L15 9" stroke="currentColor" strokeWidth="0.9" fill="none" />
      <path d="M10 11.5 L8 19" stroke="currentColor" strokeWidth="0.9" />
      <path d="M16 11.5 L18 19" stroke="currentColor" strokeWidth="0.9" />
      <path d="M8 19 Q13 20, 18 19" stroke="currentColor" strokeWidth="0.9" fill="none" />

      <circle cx="39" cy="6.5" r="2" stroke="currentColor" strokeWidth="0.9" fill="none" />
      <path d="M38 6 C37 5, 36 5.5, 36.5 6.5" stroke="currentColor" strokeWidth="0.6" fill="none" />
      <path d="M37 9 L36 11.5 L39 12.5 L42 11.5 L41 9" stroke="currentColor" strokeWidth="0.9" fill="none" />
      <path d="M36 11.5 L34 19" stroke="currentColor" strokeWidth="0.9" />
      <path d="M42 11.5 L44 19" stroke="currentColor" strokeWidth="0.9" />
      <path d="M34 19 Q39 20, 44 19" stroke="currentColor" strokeWidth="0.9" fill="none" />

      <circle cx="13" cy="30.5" r="2" stroke="currentColor" strokeWidth="0.9" fill="none" />
      <path d="M12 30 C11 29, 10 29.5, 10.5 30.5" stroke="currentColor" strokeWidth="0.6" fill="none" />
      <path d="M11 33 L10 35.5 L13 36.5 L16 35.5 L15 33" stroke="currentColor" strokeWidth="0.9" fill="none" />
      <path d="M10 35.5 L8 43" stroke="currentColor" strokeWidth="0.9" />
      <path d="M16 35.5 L18 43" stroke="currentColor" strokeWidth="0.9" />
      <path d="M8 43 Q13 44, 18 43" stroke="currentColor" strokeWidth="0.9" fill="none" />

      <circle cx="39" cy="30.5" r="2" stroke="currentColor" strokeWidth="0.9" fill="none" />
      <path d="M38 30 C37 29, 36 29.5, 36.5 30.5" stroke="currentColor" strokeWidth="0.6" fill="none" />
      <path d="M37 33 L36 35.5 L39 36.5 L42 35.5 L41 33" stroke="currentColor" strokeWidth="0.9" fill="none" />
      <path d="M36 35.5 L34 43" stroke="currentColor" strokeWidth="0.9" />
      <path d="M42 35.5 L44 43" stroke="currentColor" strokeWidth="0.9" />
      <path d="M34 43 Q39 44, 44 43" stroke="currentColor" strokeWidth="0.9" fill="none" />
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