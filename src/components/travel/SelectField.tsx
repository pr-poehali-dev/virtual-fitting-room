import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
}

const SelectField = ({
  label,
  value,
  onChange,
  options,
  placeholder = "Не выбрано",
  required,
}: SelectFieldProps) => (
  <div>
    <p className="font-medium mb-2">
      {label} {required && <span className="text-destructive">*</span>}
    </p>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

export default SelectField;
