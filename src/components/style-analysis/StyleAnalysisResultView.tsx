import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Icon from "@/components/ui/icon";
import StyleAnalysisReport, {
  StyleAnalysisResult,
} from "@/components/StyleAnalysisReport";

interface StyleAnalysisResultViewProps {
  resultData: StyleAnalysisResult | null;
  resultUrl: string | null;
  handleDownload: () => void;
  handleReset: () => void;
}

export default function StyleAnalysisResultView({
  resultData,
  resultUrl,
  handleDownload,
  handleReset,
}: StyleAnalysisResultViewProps) {
  if (resultData) {
    return (
      <div className="space-y-6 animate-fade-in">
        <StyleAnalysisReport result={resultData} imageUrl={resultUrl} />
        <div className="flex justify-center">
          <Button size="lg" variant="outline" onClick={handleReset}>
            <Icon name="RotateCcw" size={18} className="mr-2" />
            Новый анализ
          </Button>
        </div>
      </div>
    );
  }

  if (resultUrl) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Card>
          <CardContent className="p-4 md:p-6">
            <img
              src={resultUrl}
              alt="Стилевой анализ"
              className="w-full rounded-lg"
            />
          </CardContent>
        </Card>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button size="lg" variant="default" onClick={handleDownload}>
            <Icon name="Download" size={18} className="mr-2" />
            Скачать
          </Button>
          <Button size="lg" variant="outline" onClick={handleReset}>
            <Icon name="RotateCcw" size={18} className="mr-2" />
            Новый анализ
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
