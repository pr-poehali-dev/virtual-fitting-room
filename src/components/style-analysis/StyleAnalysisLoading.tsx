import { Card, CardContent } from "@/components/ui/card";
import Icon from "@/components/ui/icon";

interface StyleAnalysisLoadingProps {
  analysisStatus: string;
}

export default function StyleAnalysisLoading({
  analysisStatus,
}: StyleAnalysisLoadingProps) {
  return (
    <Card>
      <CardContent className="p-10 flex flex-col items-center justify-center text-center min-h-[340px]">
        <Icon
          name="Loader2"
          size={48}
          className="animate-spin text-primary mb-4"
        />
        <p className="text-lg font-medium mb-1">
          {analysisStatus || "Создаём вашу инфографику..."}
        </p>
        <p className="text-sm text-muted-foreground max-w-sm">
          Это займёт 1–2 минуты. Не закрывайте страницу — результат появится
          здесь автоматически.
        </p>
      </CardContent>
    </Card>
  );
}
