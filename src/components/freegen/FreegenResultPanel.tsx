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
    const IMAGE_PROXY_API = 'https://functions.poehali.dev/7f105c4b-f9e7-4df3-9f64-3d35895b8e90';
    try {
      let blob: Blob;
      const needsProxy = !resultUrl.includes('cdn.poehali.dev');

      if (needsProxy) {
        const sessionToken = localStorage.getItem('session_token');
        const proxyResponse = await fetch(IMAGE_PROXY_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(sessionToken ? { 'X-Session-Token': sessionToken } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({ image_url: resultUrl }),
        });
        if (!proxyResponse.ok) throw new Error('Failed to proxy image for download');
        const proxyData = await proxyResponse.json();
        const response = await fetch(proxyData.data_url);
        blob = await response.blob();
      } else {
        const response = await fetch(resultUrl);
        blob = await response.blob();
      }

      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
    } catch (error) {
      console.error('Failed to download image:', error);
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