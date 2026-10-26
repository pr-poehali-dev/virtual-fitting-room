import Icon from "@/components/ui/icon";

export function SectionTitle({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-lg font-semibold text-primary mb-3">
      <Icon name={icon} size={20} />
      {children}
    </h3>
  );
}

export function TextSection({ icon, title, text }: { icon: string; title: string; text?: string }) {
  if (!text) return null;
  return (
    <div>
      <SectionTitle icon={icon}>{title}</SectionTitle>
      <p className="text-sm text-muted-foreground whitespace-pre-line">{text}</p>
    </div>
  );
}

export function BulletSection({
  icon,
  title,
  items,
}: {
  icon: string;
  title: string;
  items?: string[];
}) {
  if (!items?.length) return null;
  return (
    <div>
      <SectionTitle icon={icon}>{title}</SectionTitle>
      <ul className="space-y-2">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2 text-sm">
            <Icon name="Check" size={16} className="mt-0.5 shrink-0 text-primary" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SafetyNote({ text }: { text?: string }) {
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm flex gap-3">
      <Icon name="ShieldAlert" size={20} className="shrink-0 text-amber-600" />
      <div>
        {text && <p className="mb-1">{text}</p>}
        <p className="text-muted-foreground">
          План носит рекомендательный характер и не заменяет консультацию врача
          или специалиста.
        </p>
      </div>
    </div>
  );
}
