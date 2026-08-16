import Icon from "@/components/ui/icon";

export type DivTab = "spreads" | "dialogs";

interface DivinationTabsProps {
  /** null — после перезагрузки страницы ничего не подсвечено, пока не выбрали */
  value: DivTab | null;
  onChange: (tab: DivTab) => void;
}

/**
 * Две категории раздела: обычные расклады и диалоги.
 * Разделены, чтобы правила сохранения и удаления не путались.
 */
const DivinationTabs = ({ value, onChange }: DivinationTabsProps) => {
  const tabs: { key: DivTab; label: string; desc: string; icon: string }[] = [
    {
      key: "spreads",
      label: "Расклады",
      desc: "Одно подробное толкование",
      icon: "LayoutGrid",
    },
    {
      key: "dialogs",
      label: "Диалоги",
      desc: "Вопрос — ответ — уточнение",
      icon: "MessagesSquare",
    },
  ];

  return (
    <div className="mb-6 grid gap-2.5 sm:grid-cols-2">
      {tabs.map((t) => {
        const active = value === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={`flex items-center gap-3 rounded-xl p-4 text-left transition ${
              active
                ? "bg-[#c9a84c]/15 ring-2 ring-[#c9a84c] shadow-lg shadow-[#c9a84c]/10"
                : "bg-white/[0.04] ring-1 ring-white/12 hover:bg-white/[0.08]"
            }`}
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                active ? "bg-[#c9a84c]/25" : "bg-white/8"
              }`}
            >
              <Icon
                name={t.icon}
                size={20}
                className={active ? "text-[#c9a84c]" : "text-[#9888b8]"}
              />
            </span>
            <span className="min-w-0">
              <span className="block font-medium text-[#f3ecff]">
                {t.label}
              </span>
              <span className="block text-xs text-[#9888b8]">{t.desc}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default DivinationTabs;