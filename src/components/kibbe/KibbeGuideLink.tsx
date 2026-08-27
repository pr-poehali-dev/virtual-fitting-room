import { Link } from 'react-router-dom';
import Icon from '@/components/ui/icon';

/** Компактные ссылки со страницы теста: на инструкцию и на каталог типажей */
export default function KibbeGuideLink() {
  return (
    <div className="mt-8 space-y-3">
      <Link
        to="/kibbe-guide"
        className="flex items-center gap-3 rounded-xl border p-4 transition-colors hover:border-purple-300 hover:bg-purple-50"
      >
        <Icon name="BookOpen" size={20} className="shrink-0 text-purple-600" />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">Как определить свой типаж самостоятельно</span>
          <span className="block text-sm text-muted-foreground">
            Пошаговая инструкция по книге Дэвида Кибби
          </span>
        </span>
        <Icon name="ChevronRight" size={18} className="shrink-0 text-purple-600" />
      </Link>

      <Link
        to="/kibbe-types"
        className="flex items-center gap-3 rounded-xl border p-4 transition-colors hover:border-purple-300 hover:bg-purple-50"
      >
        <Icon name="LayoutGrid" size={20} className="shrink-0 text-purple-600" />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">Все 10 типажей с описаниями</span>
          <span className="block text-sm text-muted-foreground">
            Силуэт, ткани, гардероб, украшения и цвета
          </span>
        </span>
        <Icon name="ChevronRight" size={18} className="shrink-0 text-purple-600" />
      </Link>
    </div>
  );
}
