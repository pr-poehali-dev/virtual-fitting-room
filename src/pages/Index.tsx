import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';

const clothingOptions = [
  { 
    id: '1', 
    name: 'Элегантное чёрное платье', 
    image: 'https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/files/25311c7a-f389-4431-83a1-e4fcdbf46690.jpg' 
  },
  { 
    id: '2', 
    name: 'Белая рубашка casual', 
    image: 'https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/files/442312b4-1dcb-4bb2-bc77-257606189287.jpg' 
  },
];

export default function Index() {
  const { user } = useAuth();
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [selectedClothing, setSelectedClothing] = useState<string>('');
  const [customClothingImage, setCustomClothingImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [clothingMode, setClothingMode] = useState<'preset' | 'custom'>('preset');

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCustomClothingUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomClothingImage(reader.result as string);
        setClothingMode('custom');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!uploadedImage) {
      toast.error('Загрузите фотографию человека');
      return;
    }

    const garmentImage = clothingMode === 'custom' ? customClothingImage : clothingOptions.find(item => item.id === selectedClothing)?.image;
    
    if (!garmentImage) {
      toast.error('Выберите или загрузите одежду');
      return;
    }

    setIsGenerating(true);
    
    try {
      const response = await fetch('https://functions.poehali.dev/87fa03b9-724d-4af9-85a2-dda57f503885', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          person_image: uploadedImage,
          garment_image: garmentImage
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate image');
      }
      
      setGeneratedImage(data.image_url);
      toast.success('Изображение успешно сгенерировано!');
      
      if (user) {
        await fetch('https://functions.poehali.dev/8436b2bf-ae39-4d91-b2b7-91951b4235cd', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': user.id
          },
          body: JSON.stringify({
            person_image: uploadedImage,
            garment_image: garmentImage,
            result_image: data.image_url
          })
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка генерации');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Layout>

      <section className="py-20 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-5xl md:text-6xl font-light mb-4">
              Виртуальная примерочная
            </h2>
            <p className="text-muted-foreground text-lg">
              Примерьте одежду онлайн с помощью AI технологий
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-start">
            <Card className="animate-scale-in">
              <CardContent className="p-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-3">
                      Загрузите фотографию
                    </label>
                    <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="photo-upload"
                      />
                      <label htmlFor="photo-upload" className="cursor-pointer">
                        {uploadedImage ? (
                          <img src={uploadedImage} alt="Uploaded" className="max-h-64 mx-auto rounded-lg" />
                        ) : (
                          <div className="space-y-3">
                            <Icon name="Upload" className="mx-auto text-muted-foreground" size={48} />
                            <p className="text-muted-foreground">
                              Нажмите для загрузки фотографии
                            </p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-3">
                      Выберите одежду
                    </label>
                    <Tabs value={clothingMode} onValueChange={(v) => setClothingMode(v as 'preset' | 'custom')} className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="preset">Из каталога</TabsTrigger>
                        <TabsTrigger value="custom">Своё фото</TabsTrigger>
                      </TabsList>
                      <TabsContent value="preset" className="mt-4">
                        <Select value={selectedClothing} onValueChange={setSelectedClothing}>
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите вариант" />
                          </SelectTrigger>
                          <SelectContent>
                            {clothingOptions.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                <div className="flex items-center gap-3">
                                  <img src={item.image} alt={item.name} className="w-8 h-8 object-cover rounded" />
                                  {item.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TabsContent>
                      <TabsContent value="custom" className="mt-4">
                        <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleCustomClothingUpload}
                            className="hidden"
                            id="clothing-upload"
                          />
                          <label htmlFor="clothing-upload" className="cursor-pointer">
                            {customClothingImage ? (
                              <img src={customClothingImage} alt="Custom clothing" className="max-h-32 mx-auto rounded-lg" />
                            ) : (
                              <div className="space-y-2">
                                <Icon name="Shirt" className="mx-auto text-muted-foreground" size={32} />
                                <p className="text-muted-foreground text-sm">
                                  Загрузите фото одежды
                                </p>
                              </div>
                            )}
                          </label>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>

                  <Button 
                    onClick={handleGenerate} 
                    disabled={isGenerating}
                    className="w-full h-12 text-base"
                    size="lg"
                  >
                    {isGenerating ? (
                      <>
                        <Icon name="Loader2" className="mr-2 animate-spin" size={20} />
                        Генерация...
                      </>
                    ) : (
                      <>
                        <Icon name="Sparkles" className="mr-2" size={20} />
                        Генерировать изображение
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="animate-scale-in" style={{ animationDelay: '0.1s' }}>
              <CardContent className="p-8">
                <div className="min-h-[500px] flex items-center justify-center bg-muted rounded-lg">
                  {generatedImage ? (
                    <img 
                      src={generatedImage} 
                      alt="Generated result" 
                      className="max-w-full max-h-[500px] object-contain rounded-lg animate-fade-in" 
                    />
                  ) : (
                    <div className="text-center space-y-3">
                      <Icon name="Image" className="mx-auto text-muted-foreground" size={48} />
                      <p className="text-muted-foreground">
                        Здесь появится изображение
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="guide" className="py-20 px-4 bg-card">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-4xl font-light text-center mb-12">
            Как пользоваться примерочной
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center space-y-4 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Icon name="Upload" className="text-primary" size={32} />
              </div>
              <h3 className="text-xl font-medium">1. Загрузите фото</h3>
              <p className="text-muted-foreground text-sm">
                Выберите чёткую фотографию в полный рост на светлом фоне
              </p>
            </div>
            <div className="text-center space-y-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Icon name="Shirt" className="text-primary" size={32} />
              </div>
              <h3 className="text-xl font-medium">2. Выберите одежду</h3>
              <p className="text-muted-foreground text-sm">
                Выберите из каталога или загрузите своё фото одежды
              </p>
            </div>
            <div className="text-center space-y-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Icon name="Sparkles" className="text-primary" size={32} />
              </div>
              <h3 className="text-xl font-medium">3. Получите результат</h3>
              <p className="text-muted-foreground text-sm">
                AI создаст реалистичное изображение с выбранной одеждой
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="py-20 px-4">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-4xl font-light text-center mb-12">
            Часто задаваемые вопросы
          </h2>
          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="item-1" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left">
                Какие требования к фотографии?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Фотография должна быть чёткой, в полный рост, на светлом однородном фоне. 
                Человек должен быть в облегающей одежде или спортивной форме для лучшего результата.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-2" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left">
                Как работает технология?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Мы используем передовые AI модели машинного обучения (GAN) и компьютерного зрения 
                для реалистичного наложения одежды на фигуру с учётом освещения и пропорций.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-3" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left">
                Сколько времени занимает генерация?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Обработка обычно занимает от 5 до 15 секунд в зависимости от качества 
                исходного изображения и загрузки сервера.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-4" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left">
                Можно ли использовать свою одежду?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Да! Переключитесь на вкладку "Своё фото" и загрузите изображение любого предмета одежды. 
                Для лучшего результата используйте фото на белом фоне.
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="item-5" className="border rounded-lg px-6">
              <AccordionTrigger className="text-left">
                Что делать, если результат неточный?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Попробуйте загрузить другую фотографию с лучшим освещением и более чётким фоном. 
                Также убедитесь, что на исходном фото видна вся фигура полностью.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      <footer className="border-t border-border py-12 px-4">
        <div className="container mx-auto text-center text-muted-foreground">
          <p className="text-sm">
            © 2025 Virtual Fitting. Технология виртуальной примерочной на базе AI
          </p>
        </div>
      </footer>
    </Layout>
  );
}