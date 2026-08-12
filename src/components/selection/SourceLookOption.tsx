import Icon from "@/components/ui/icon";
import { SourceLook } from "@/lib/weddingSourceLooks";

/** Строка выпадающего списка готового образа: миниатюра + название и услуга. */
export default function SourceLookOption({ look }: { look: SourceLook }) {
  return (
    <div className="flex items-center gap-3 py-0.5">
      {look.imageUrl ? (
        <img
          src={look.imageUrl}
          alt=""
          loading="lazy"
          className="h-10 w-10 shrink-0 rounded-md object-cover bg-muted"
        />
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon name="Image" size={16} />
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-sm">{look.title}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {look.serviceLabel}
          {look.createdAt
            ? ` · ${new Date(look.createdAt).toLocaleDateString("ru-RU")}`
            : ""}
        </span>
      </span>
    </div>
  );
}
