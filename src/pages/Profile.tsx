import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import Layout from '@/components/Layout';

interface Lookbook {
  id: string;
  name: string;
  personName: string;
  photos: string[];
  colorPalette: string[];
  createdAt: Date;
}

interface TryOnHistory {
  id: string;
  personImage: string;
  garmentImage: string;
  resultImage: string;
  timestamp: Date;
}

export default function Profile() {
  const [lookbooks, setLookbooks] = useState<Lookbook[]>([]);
  const [tryOnHistory, setTryOnHistory] = useState<TryOnHistory[]>([]);
  const [isCreatingLookbook, setIsCreatingLookbook] = useState(false);
  const [newLookbookName, setNewLookbookName] = useState('');
  const [newPersonName, setNewPersonName] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [colorPalette, setColorPalette] = useState<string[]>(['#FF6B6B', '#4ECDC4', '#45B7D1']);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setSelectedPhotos(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleCreateLookbook = () => {
    if (!newLookbookName || !newPersonName) {
      toast.error('Заполните название и имя');
      return;
    }

    const newLookbook: Lookbook = {
      id: Date.now().toString(),
      name: newLookbookName,
      personName: newPersonName,
      photos: selectedPhotos,
      colorPalette: colorPalette,
      createdAt: new Date()
    };

    setLookbooks(prev => [...prev, newLookbook]);
    setNewLookbookName('');
    setNewPersonName('');
    setSelectedPhotos([]);
    setIsCreatingLookbook(false);
    toast.success('Лукбук создан!');
  };

  const handleDeleteLookbook = (id: string) => {
    setLookbooks(prev => prev.filter(lb => lb.id !== id));
    toast.success('Лукбук удалён');
  };

  const handleAddColor = () => {
    const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16);
    setColorPalette(prev => [...prev, randomColor]);
  };

  const handleRemoveColor = (index: number) => {
    setColorPalette(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <Layout>
      <section className="py-12 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="mb-8">
            <h2 className="text-4xl font-light mb-2">Личный кабинет</h2>
            <p className="text-muted-foreground">Управляйте лукбуками и историей примерок</p>
          </div>

          <Tabs defaultValue="lookbooks" className="w-full">
            <TabsList className="grid w-full md:w-auto grid-cols-2 mb-8">
              <TabsTrigger value="lookbooks">Лукбуки</TabsTrigger>
              <TabsTrigger value="history">История примерок</TabsTrigger>
            </TabsList>

            <TabsContent value="lookbooks">
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-light">Мои лукбуки</h3>
                  <Dialog open={isCreatingLookbook} onOpenChange={setIsCreatingLookbook}>
                    <DialogTrigger asChild>
                      <Button>
                        <Icon name="Plus" className="mr-2" size={18} />
                        Создать лукбук
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Новый лукбук</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-6 py-4">
                        <div>
                          <label className="block text-sm font-medium mb-2">Название лукбука</label>
                          <Input
                            value={newLookbookName}
                            onChange={(e) => setNewLookbookName(e.target.value)}
                            placeholder="Например: Весна 2025"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2">Для кого</label>
                          <Input
                            value={newPersonName}
                            onChange={(e) => setNewPersonName(e.target.value)}
                            placeholder="Имя человека"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2">Фотографии одежды</label>
                          <div className="border-2 border-dashed rounded-lg p-6 text-center">
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={handlePhotoUpload}
                              className="hidden"
                              id="lookbook-photos"
                            />
                            <label htmlFor="lookbook-photos" className="cursor-pointer">
                              <Icon name="Upload" className="mx-auto mb-2 text-muted-foreground" size={32} />
                              <p className="text-sm text-muted-foreground">Загрузите фото одежды</p>
                            </label>
                          </div>
                          {selectedPhotos.length > 0 && (
                            <div className="grid grid-cols-4 gap-2 mt-4">
                              {selectedPhotos.map((photo, index) => (
                                <img key={index} src={photo} alt="" className="w-full h-24 object-cover rounded" />
                              ))}
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2">Цветовая палитра</label>
                          <div className="flex gap-2 flex-wrap mb-2">
                            {colorPalette.map((color, index) => (
                              <div key={index} className="relative group">
                                <div
                                  className="w-12 h-12 rounded-lg shadow-sm cursor-pointer"
                                  style={{ backgroundColor: color }}
                                />
                                <button
                                  onClick={() => handleRemoveColor(index)}
                                  className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={handleAddColor}
                              className="w-12 h-12 rounded-lg border-2 border-dashed flex items-center justify-center hover:border-primary transition-colors"
                            >
                              <Icon name="Plus" size={20} />
                            </button>
                          </div>
                        </div>

                        <Button onClick={handleCreateLookbook} className="w-full">
                          Создать лукбук
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {lookbooks.length === 0 ? (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <Icon name="BookOpen" className="mx-auto mb-4 text-muted-foreground" size={48} />
                      <p className="text-muted-foreground">У вас пока нет лукбуков</p>
                      <p className="text-sm text-muted-foreground mt-2">Создайте первый лукбук для организации гардероба</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {lookbooks.map((lookbook) => (
                      <Card key={lookbook.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-xl">{lookbook.name}</CardTitle>
                              <p className="text-sm text-muted-foreground mt-1">Для: {lookbook.personName}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteLookbook(lookbook.id)}
                            >
                              <Icon name="Trash2" size={16} />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {lookbook.photos.length > 0 && (
                            <div className="grid grid-cols-3 gap-2 mb-4">
                              {lookbook.photos.slice(0, 3).map((photo, index) => (
                                <img key={index} src={photo} alt="" className="w-full h-20 object-cover rounded" />
                              ))}
                            </div>
                          )}
                          <div className="flex gap-2">
                            {lookbook.colorPalette.slice(0, 5).map((color, index) => (
                              <div
                                key={index}
                                className="w-8 h-8 rounded-full shadow-sm"
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="history">
              <div className="space-y-6">
                <h3 className="text-2xl font-light">История примерок</h3>
                
                {tryOnHistory.length === 0 ? (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <Icon name="History" className="mx-auto mb-4 text-muted-foreground" size={48} />
                      <p className="text-muted-foreground">История примерок пуста</p>
                      <p className="text-sm text-muted-foreground mt-2">Используйте виртуальную примерочную, чтобы начать</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tryOnHistory.map((item) => (
                      <Card key={item.id} className="overflow-hidden">
                        <CardContent className="p-4">
                          <img src={item.resultImage} alt="" className="w-full h-64 object-cover rounded-lg mb-3" />
                          <div className="flex gap-2">
                            <img src={item.personImage} alt="" className="w-16 h-16 object-cover rounded" />
                            <img src={item.garmentImage} alt="" className="w-16 h-16 object-cover rounded" />
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            {item.timestamp.toLocaleDateString()}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </Layout>
  );
}
