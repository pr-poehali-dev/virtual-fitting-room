import { useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import Icon from '@/components/ui/icon';

interface ParagraphEditorProps {
  value: string;
  onChange: (value: string) => void;
}

type WrapAction = { kind: 'wrap'; before: string; after: string; placeholder: string };
type LinePrefixAction = { kind: 'linePrefix'; prefix: string };
type ToolAction = WrapAction | LinePrefixAction;

const TOOLS: { icon: string; title: string; action: ToolAction }[] = [
  {
    icon: 'Bold',
    title: 'Жирный',
    action: { kind: 'wrap', before: '**', after: '**', placeholder: 'жирный текст' },
  },
  {
    icon: 'Italic',
    title: 'Курсив',
    action: { kind: 'wrap', before: '*', after: '*', placeholder: 'курсив' },
  },
  {
    icon: 'List',
    title: 'Маркированный список',
    action: { kind: 'linePrefix', prefix: '- ' },
  },
  {
    icon: 'ListOrdered',
    title: 'Нумерованный список',
    action: { kind: 'linePrefix', prefix: '1. ' },
  },
];

export default function ParagraphEditor({ value, onChange }: ParagraphEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const applyWrap = (a: WrapAction) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || a.placeholder;
    const next = value.slice(0, start) + a.before + selected + a.after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const s = start + a.before.length;
      el.setSelectionRange(s, s + selected.length);
    });
  };

  const applyLinePrefix = (a: LinePrefixAction) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = value.indexOf('\n', end);
    if (lineEnd === -1) lineEnd = value.length;
    const segment = value.slice(lineStart, lineEnd);
    const lines = segment.split('\n');
    const prefixed = lines
      .map((line) => (line.startsWith(a.prefix) ? line : a.prefix + line))
      .join('\n');
    const next = value.slice(0, lineStart) + prefixed + value.slice(lineEnd);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(lineStart, lineStart + prefixed.length);
    });
  };

  const handle = (action: ToolAction) => {
    if (action.kind === 'wrap') applyWrap(action);
    else applyLinePrefix(action);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1">
        {TOOLS.map((t) => (
          <button
            key={t.title}
            type="button"
            title={t.title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handle(t.action)}
            className="h-8 w-8 flex items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Icon name={t.icon} size={16} />
          </button>
        ))}
        <span className="ml-1 text-xs text-muted-foreground">
          Выделите текст и нажмите кнопку. **жирный**, *курсив*, «- » — список
        </span>
      </div>
      <Textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Текст абзаца"
        rows={5}
      />
    </div>
  );
}
