import Icon from "@/components/ui/icon";
import ImageViewer from "@/components/ImageViewer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SelectedClothing } from "./clothingSelectorTypes";

interface SelectedClothingListProps {
  selectedClothingItems: SelectedClothing[];
  removeClothingItem: (id: string) => void;
  updateClothingCategory: (id: string, category: string) => void;
  isGenerating: boolean;
  showCategoryError: boolean;
}

export default function SelectedClothingList({
  selectedClothingItems,
  removeClothingItem,
  updateClothingCategory,
  isGenerating,
  showCategoryError,
}: SelectedClothingListProps) {
  const getCategoryHint = (
    itemId: string,
    currentCategory: string | undefined,
  ) => {
    if ((selectedClothingItems?.length || 0) === 1) {
      if (currentCategory === "dresses") {
        return "Это фото полного образа";
      }
      return "Любая категория";
    }

    if ((selectedClothingItems?.length || 0) === 2) {
      const otherItem = selectedClothingItems?.find(
        (item) => item.id !== itemId,
      );
      if (!otherItem || !otherItem.category) {
        return "Выберите категорию";
      }

      if (currentCategory === "dresses") {
        return "Это фото полного образа (нельзя комбинировать с другими вещами)";
      }

      if (otherItem.category === "dresses") {
        return "Другая вещь — полный образ (нельзя комбинировать)";
      }

      if (otherItem.category === "upper_body") {
        if (currentCategory === "upper_body") {
          return "Выберите фото из категории низ (брюки, шорты, юбки)";
        }
        return currentCategory === "lower_body"
          ? "Низ (правильно ✓)"
          : "Нужен низ (брюки, юбки, шорты)";
      }

      if (otherItem.category === "lower_body") {
        if (currentCategory === "lower_body") {
          return "Выберите фото из категории верх (топы, рубашки, жакеты)";
        }
        return currentCategory === "upper_body"
          ? "Верх (правильно ✓)"
          : "Нужен верх (топы, рубашки, жакеты)";
      }
    }

    return "";
  };

  if ((selectedClothingItems?.length || 0) === 0) {
    return null;
  }

  return (
    <div className="mb-4 space-y-3">
      <p className="text-sm text-muted-foreground">
        Выбрано: {selectedClothingItems?.length || 0}
      </p>
      <div className="space-y-3">
        {selectedClothingItems?.map((item) => (
          <div
            key={item.id}
            className="flex gap-3 p-3 border rounded-lg bg-card"
          >
            <div className="relative flex-shrink-0 w-20 h-20">
              <ImageViewer
                src={item.image}
                alt={item.name || "Clothing"}
                className="w-full h-full object-cover rounded border-2 border-primary bg-muted"
              />
              {item.category && (
                <div
                  className={`absolute -top-2 -left-2 px-2 py-0.5 rounded-full text-xs font-semibold shadow-sm ${
                    item.category === "upper_body"
                      ? "bg-blue-500 text-white"
                      : item.category === "lower_body"
                        ? "bg-green-500 text-white"
                        : "bg-purple-500 text-white"
                  }`}
                >
                  {item.category === "upper_body"
                    ? "👕 Верх"
                    : item.category === "lower_body"
                      ? "👖 Низ"
                      : "👗 Образ"}
                </div>
              )}
              <button
                onClick={() => removeClothingItem(item.id)}
                className="absolute -top-2 -right-2 bg-gray-600 hover:bg-gray-700 text-white rounded-full p-1 shadow-sm transition-colors"
                disabled={isGenerating}
              >
                <Icon name="X" size={14} />
              </button>
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <p className="text-sm font-medium truncate">
                {item.name || "Одежда"}
              </p>
              <Select
                value={item.category || ""}
                onValueChange={(value) =>
                  updateClothingCategory(item.id, value)
                }
                disabled={
                  item.isFromCatalog ||
                  isGenerating ||
                  ((selectedClothingItems?.length || 0) === 2 &&
                    item.category &&
                    selectedClothingItems?.find(
                      (i) =>
                        i.id !== item.id &&
                        i.category &&
                        i.category !== item.category &&
                        ["upper_body", "lower_body"].includes(i.category),
                    ) !== undefined)
                }
              >
                <SelectTrigger
                  className={`h-8 text-xs ${showCategoryError && !item.category ? "border-red-500 border-2" : ""}`}
                >
                  <SelectValue
                    placeholder="Выберите категорию"
                    className={
                      showCategoryError && !item.category
                        ? "text-red-500"
                        : ""
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upper_body" className="text-xs">
                    Верх (Топы, Рубашки, Жакеты)
                  </SelectItem>
                  <SelectItem value="lower_body" className="text-xs">
                    Низ (Брюки, Юбки, Шорты)
                  </SelectItem>
                  {(selectedClothingItems?.length || 0) === 1 && (
                    <SelectItem value="dresses" className="text-xs">
                      Весь образ, платья, верх и низ вместе
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {getCategoryHint(item.id, item.category) && (
                <p
                  className={`text-xs ${showCategoryError && !item.category ? "text-red-500 font-medium" : "text-muted-foreground"}`}
                >
                  {getCategoryHint(item.id, item.category)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
