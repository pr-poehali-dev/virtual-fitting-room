import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface Props {
  resultUrl: string | null;
  isGenerating: boolean;
  statusText: string;
  aspectRatio: string;
}

function aspectCssRatio(ar: string): string {
  if (ar === 'auto') return '1 / 1';
  if (ar.includes(':')) {
    const [w, h] = ar.split(':').map(Number);
    if (!Number.isNaN(w) && !Number.isNaN(h) && h > 0) return `${w} / ${h}`;
  }
  return '1 / 1';
}

export default function FreegenResultPanel({
  resultUrl,
  isGenerating,
  statusText,
  aspectRatio,
}: Props) {
  const handleDownload = async () => {
    if (!resultUrl) return;
    const filename = `freegen-${Date.now()}.png`;
    try {
      const res = await fetch(resultUrl, { mode: 'cors', cache: 'no-store' });
      if (!res.ok) throw new Error('fetch failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      const a = document.createElement('a');
      a.href = resultUrl;
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <Card className="sticky top-24">
      <CardContent className="pt-6">
        <div
          className="w-full rounded-lg bg-muted flex items-center justify-center overflow-hidden"
          style={{ aspectRatio: aspectCssRatio(aspectRatio) }}
        >
          {resultUrl ? (
            <img src={resultUrl} alt="Результат" className="w-full h-full object-contain" />
          ) : isGenerating ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Icon name="Loader2" size={40} className="animate-spin" />
              <span className="text-sm">{statusText || 'Генерация...'}</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Icon name="Image" size={40} />
              <span className="text-sm">Результат появится здесь</span>
            </div>
          )}
        </div>

        {resultUrl && (
          <div className="mt-4 flex gap-2">
            <Button onClick={handleDownload} variant="outline" className="flex-1">
              <Icon name="Download" size={16} className="mr-2" />
              Скачать
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}