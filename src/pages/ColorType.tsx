import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import Layout from '@/components/Layout';

const colorTypes = {
  'warm_spring': {
    name: 'Тёплая Весна',
    description: 'тёплый, яркий',
    colors: ['#FF6B6B', '#FFA94D', '#FFD93D', '#6BCF7F', '#95E1D3']
  },
  'light_spring': {
    name: 'Светлая Весна',
    description: 'светлый, тёплый',
    colors: ['#FFE5B4', '#FFDAB9', '#FFE4E1', '#F0E68C', '#FFB6C1']
  },
  'light_summer': {
    name: 'Светлое Лето',
    description: 'светлый, холодный',
    colors: ['#E6E6FA', '#D8BFD8', '#DDA0DD', '#B0C4DE', '#ADD8E6']
  },
  'cool_summer': {
    name: 'Холодное Лето',
    description: 'холодный, мягкий',
    colors: ['#9370DB', '#8A7FC7', '#7B68EE', '#6A5ACD', '#9999CC']
  },
  'soft_summer': {
    name: 'Мягкое Лето',
    description: 'тёмный, холодный',
    colors: ['#778899', '#708090', '#696969', '#556B2F', '#6B8E23']
  },
  'soft_autumn': {
    name: 'Мягкая Осень',
    description: 'мягкий, тёплый',
    colors: ['#BC8F8F', '#CD853F', '#D2691E', '#B8860B', '#DAA520']
  },
  'warm_autumn': {
    name: 'Тёплая Осень',
    description: 'тёплый, мягкий',
    colors: ['#FF8C00', '#FF7F50', '#D2691E', '#CD853F', '#B8860B']
  },
  'dark_autumn': {
    name: 'Тёмная Осень',
    description: 'тёмный, тёплый',
    colors: ['#8B4513', '#A0522D', '#6B4423', '#654321', '#704214']
  },
  'dark_winter': {
    name: 'Тёмная Зима',
    description: 'тёмный, холодный',
    colors: ['#000000', '#2F4F4F', '#191970', '#1C1C1C', '#36454F']
  },
  'bright_spring': {
    name: 'Яркая Весна',
    description: 'светло-лососевый и сочно-зелёный',
    colors: ['#FFA07A', '#00FA9A', '#FF6347', '#32CD32', '#FFD700']
  },
  'bright_winter': {
    name: 'Яркая Зима',
    description: 'цвет цикламена и тёмно-бирюзовый',
    colors: ['#FF1493', '#008B8B', '#FF00FF', '#20B2AA', '#C71585']
  },
  'cool_winter': {
    name: 'Холодная Зима',
    description: 'цвет фуксии и сливовый',
    colors: ['#FF00FF', '#8E4585', '#C71585', '#663399', '#9932CC']
  }
};

export default function ColorType() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [colorTypeResult, setColorTypeResult] = useState<keyof typeof colorTypes | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
        setColorTypeResult(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!uploadedImage) {
      toast.error('Загрузите портретное фото');
      return;
    }

    setIsAnalyzing(true);

    try {
      const response = await fetch('https://functions.poehali.dev/dc1d4a27-c7b0-448b-8b71-3dc704a7c27b', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: uploadedImage
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze color type');
      }

      setColorTypeResult(data.color_type);
      toast.success('Цветотип определён!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка анализа');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const currentColorType = colorTypeResult ? colorTypes[colorTypeResult] : null;

  return (
    <Layout>
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-5xl md:text-6xl font-light mb-4">
              Определение цветотипа
            </h2>
            <p className="text-muted-foreground text-lg">
              Узнайте свой цветотип и подходящую палитру с помощью AI
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-start">
            <Card className="animate-scale-in">
              <CardContent className="p-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-3">
                      Загрузите портретное фото
                    </label>
                    <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="portrait-upload"
                      />
                      <label htmlFor="portrait-upload" className="cursor-pointer">
                        {uploadedImage ? (
                          <img src={uploadedImage} alt="Uploaded" className="max-h-64 mx-auto rounded-lg" />
                        ) : (
                          <div className="space-y-3">
                            <Icon name="Upload" className="mx-auto text-muted-foreground" size={48} />
                            <p className="text-muted-foreground">
                              Нажмите для загрузки портрета
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Для лучшего результата используйте фото при естественном освещении
                            </p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  <Button 
                    onClick={handleAnalyze} 
                    disabled={isAnalyzing}
                    className="w-full h-12 text-base"
                    size="lg"
                  >
                    {isAnalyzing ? (
                      <>
                        <Icon name="Loader2" className="mr-2 animate-spin" size={20} />
                        Анализ...
                      </>
                    ) : (
                      <>
                        <Icon name="Palette" className="mr-2" size={20} />
                        Определить цветотип внешности
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="animate-scale-in" style={{ animationDelay: '0.1s' }}>
              <CardContent className="p-8">
                <div className="min-h-[500px] flex items-center justify-center">
                  {currentColorType ? (
                    <div className="w-full space-y-6 animate-fade-in">
                      <div className="text-center">
                        <h3 className="text-3xl font-light mb-2">{currentColorType.name}</h3>
                        <p className="text-muted-foreground">{currentColorType.description}</p>
                      </div>
                      
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-center">Ваша палитра:</p>
                        <div className="grid grid-cols-5 gap-3">
                          {currentColorType.colors.map((color, index) => (
                            <div key={index} className="space-y-2">
                              <div
                                className="aspect-square rounded-lg shadow-md hover:scale-110 transition-transform cursor-pointer"
                                style={{ backgroundColor: color }}
                              />
                              <p className="text-xs text-center text-muted-foreground font-mono">
                                {color}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-muted rounded-lg p-4 text-sm text-muted-foreground">
                        <p className="text-center">
                          Эти цвета подчеркнут вашу природную красоту и создадут гармоничный образ
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center space-y-3">
                      <Icon name="Palette" className="mx-auto text-muted-foreground" size={48} />
                      <p className="text-muted-foreground">
                        Здесь появится ваш цветотип и палитра
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-20 px-4 bg-card">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-4xl font-light text-center mb-12">
            О цветотипах внешности
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {Object.entries(colorTypes).map(([key, type], index) => (
              <Card key={key} className="animate-fade-in" style={{ animationDelay: `${index * 0.05}s` }}>
                <CardHeader>
                  <CardTitle className="text-lg">{type.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">{type.description}</p>
                  <div className="flex gap-2">
                    {type.colors.slice(0, 5).map((color, i) => (
                      <div
                        key={i}
                        className="w-8 h-8 rounded-full shadow-sm"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-12 px-4">
        <div className="container mx-auto text-center text-muted-foreground">
          <p className="text-sm">
            © 2025 Virtual Fitting. Технология определения цветотипа на базе AI
          </p>
        </div>
      </footer>
    </Layout>
  );
}