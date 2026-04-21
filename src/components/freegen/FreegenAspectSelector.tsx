import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Props {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

const RATIOS: { value: string; label: string }[] = [
  { value: 'auto', label: 'Авто' },
  { value: '1:1', label: 'Квадрат 1:1' },
  { value: '4:5', label: 'Портрет 4:5' },
  { value: '3:4', label: 'Портрет 3:4' },
  { value: '2:3', label: 'Портрет 2:3' },
  { value: '9:16', label: 'Вертикаль 9:16' },
  { value: '1:4', label: 'Узкая вертикаль 1:4' },
  { value: '1:8', label: 'Супер-вертикаль 1:8' },
  { value: '5:4', label: 'Альбом 5:4' },
  { value: '4:3', label: 'Альбом 4:3' },
  { value: '3:2', label: 'Альбом 3:2' },
  { value: '16:9', label: 'Горизонталь 16:9' },
  { value: '21:9', label: 'Панорама 21:9' },
  { value: '4:1', label: 'Узкая панорама 4:1' },
  { value: '8:1', label: 'Супер-панорама 8:1' },
];

export default function FreegenAspectSelector({ value, onChange, disabled }: Props) {
  return (
    <div>
      <Label htmlFor="freegen-aspect" className="mb-2 block">
        Формат (разрешение 1K)
      </Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id="freegen-aspect">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {RATIOS.map((r) => (
            <SelectItem key={r.value} value={r.value}>
              {r.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
