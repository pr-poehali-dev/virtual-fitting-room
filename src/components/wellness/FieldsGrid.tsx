import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import Icon from "@/components/ui/icon";
import { toast } from "sonner";
import SelectField from "@/components/travel/SelectField";
import ChipGroup from "@/components/travel/ChipGroup";
import { FieldDef, FieldValues } from "@/lib/wellnessOptions";

interface Props {
  title: string;
  icon: string;
  fields: FieldDef[];
  values: FieldValues;
  onChange: (next: FieldValues) => void;
  highlighted?: boolean;
}

const asStr = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
const asList = (v: string | string[] | undefined) => (Array.isArray(v) ? v : []);

const FieldsGrid = ({ title, icon, fields, values, onChange, highlighted }: Props) => {
  const set = (key: string, v: string | string[]) => onChange({ ...values, [key]: v });

  const toggle = (f: FieldDef, item: string) => {
    const list = asList(values[f.key]);
    if (list.includes(item)) {
      set(f.key, list.filter((x) => x !== item));
      return;
    }
    if (f.max && list.length >= f.max) {
      toast.error(`Можно выбрать не более ${f.max}`);
      return;
    }
    set(f.key, [...list, item]);
  };

  const label = (f: FieldDef) => (
    <p className="font-medium mb-2">
      {f.label} {f.required && <span className="text-destructive">*</span>}
    </p>
  );

  return (
    <div
      className={`space-y-5 ${
        highlighted ? "rounded-xl border border-primary/20 bg-primary/5 p-5" : ""
      }`}
    >
      <p className="font-semibold flex items-center gap-2 text-lg">
        <Icon name={icon} size={20} className="text-primary" />
        {title}
      </p>
      <div className="grid md:grid-cols-3 gap-4">
        {fields.map((f) => {
          const wide = f.wide ? "md:col-span-3" : "";
          if (f.type === "select")
            return (
              <div key={f.key} className={wide}>
                <SelectField
                  label={f.label}
                  value={asStr(values[f.key])}
                  onChange={(v) => set(f.key, v)}
                  options={f.options || []}
                  required={f.required}
                />
              </div>
            );
          if (f.type === "chips")
            return (
              <div key={f.key} className={wide}>
                <ChipGroup
                  title={f.required ? `${f.label} *` : f.label}
                  hint={f.hint}
                  options={f.options || []}
                  selected={asList(values[f.key])}
                  onToggle={(v) => toggle(f, v)}
                />
              </div>
            );
          if (f.type === "textarea")
            return (
              <div key={f.key} className={wide}>
                {label(f)}
                <Textarea
                  rows={3}
                  placeholder={f.placeholder}
                  value={asStr(values[f.key])}
                  onChange={(e) => set(f.key, e.target.value)}
                  maxLength={1000}
                />
              </div>
            );
          return (
            <div key={f.key} className={wide}>
              {label(f)}
              <Input
                type={f.type === "number" ? "number" : "text"}
                placeholder={f.placeholder}
                value={asStr(values[f.key])}
                onChange={(e) => set(f.key, e.target.value)}
                maxLength={300}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FieldsGrid;
