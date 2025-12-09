import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';
import ImageViewer from '@/components/ImageViewer';
import ImageCropper from '@/components/ImageCropper';
import ProfileMenu from '@/components/ProfileMenu';
import { jsPDF } from 'jspdf';

interface Lookbook {
  id: string;
  name: string;
  person_name: string;
  photos: string[];
  color_palette: string[];
  is_public?: boolean;
  share_token?: string;
  created_at: string;
  updated_at: string;
}

const LOOKBOOKS_API = 'https://functions.poehali.dev/69de81d7-5596-4e1d-bbd3-4b3e1a520d6b';
const IMAGE_PREPROCESSING_API = 'https://functions.poehali.dev/3fe8c892-ab5f-4d26-a2c5-ae4166276334';

export default function ProfileLookbooks() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [lookbooks, setLookbooks] = useState<Lookbook[]>([]);
  const [isCreatingLookbook, setIsCreatingLookbook] = useState(false);
  const [isEditingLookbook, setIsEditingLookbook] = useState(false);
  const [editingLookbookId, setEditingLookbookId] = useState<string | null>(null);
  const [newLookbookName, setNewLookbookName] = useState('');
  const [newPersonName, setNewPersonName] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [colorPalette, setColorPalette] = useState<string[]>(['#FF6B6B', '#4ECDC4', '#45B7D1']);
  const [isLoading, setIsLoading] = useState(true);
  const [showCropper, setShowCropper] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string>('');
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState<number | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [viewingLookbook, setViewingLookbook] = useState<Lookbook | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [selectedPhotoIndexes, setSelectedPhotoIndexes] = useState<number[]>([]);
  const [targetLookbookId, setTargetLookbookId] = useState<string>('');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
      return;
    }
    
    if (user) {
      fetchLookbooks();
    }
  }, [user, authLoading, navigate]);

  if (authLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
          <Icon name="Loader2" className="animate-spin" size={48} />
        </div>
      </Layout>
    );
  }

  if (!user) {
    return null;
  }

  const fetchLookbooks = async () => {
    try {
      const response = await fetch(LOOKBOOKS_API, {
        headers: {
          'X-User-Id': user?.id || ''
        }
      });
      const data = await response.json();
      setLookbooks(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error('Ошибка загрузки лукбуков');
      setLookbooks([]);
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleCreateLookbook = async () => {
    if (!newLookbookName || !newPersonName) {
      toast.error('Заполните название и имя');
      return;
    }

    try {
      const response = await fetch(LOOKBOOKS_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': user.id
        },
        body: JSON.stringify({
          name: newLookbookName,
          person_name: newPersonName,
          photos: selectedPhotos,
          color_palette: colorPalette
        })
      });

      if (!response.ok) throw new Error('Failed to create lookbook');
      
      const newLookbook = await response.json();
      setLookbooks(prev => [newLookbook, ...prev]);
      await fetchLookbooks();
      
      setNewLookbookName('');
      setNewPersonName('');
      setSelectedPhotos([]);
      setColorPalette(['#FF6B6B', '#4ECDC4', '#45B7D1']);
      setIsCreatingLookbook(false);
      toast.success('Лукбук создан!');
    } catch (error) {
      toast.error('Ошибка создания лукбука');
    }
  };

  const handleEditLookbook = (lookbook: Lookbook) => {
    setEditingLookbookId(lookbook.id);
    setNewLookbookName(lookbook.name);
    setNewPersonName(lookbook.person_name);
    setSelectedPhotos(lookbook.photos);
    setColorPalette(lookbook.color_palette);
    setIsEditingLookbook(true);
  };

  const handleUpdateLookbook = async () => {
    if (!editingLookbookId) return;

    try {
      const response = await fetch(LOOKBOOKS_API, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': user.id
        },
        body: JSON.stringify({
          id: editingLookbookId,
          name: newLookbookName,
          person_name: newPersonName,
          photos: selectedPhotos,
          color_palette: colorPalette
        })
      });

      if (!response.ok) throw new Error('Failed to update lookbook');
      
      setLookbooks(prev => prev.map(lb => 
        lb.id === editingLookbookId 
          ? { ...lb, name: newLookbookName, person_name: newPersonName, photos: selectedPhotos, color_palette: colorPalette, updated_at: new Date().toISOString() }
          : lb
      ));
      
      await fetchLookbooks();
      
      setNewLookbookName('');
      setNewPersonName('');
      setSelectedPhotos([]);
      setColorPalette(['#FF6B6B', '#4ECDC4', '#45B7D1']);
      setSelectedPhotoIndexes([]);
      setTargetLookbookId('');
      setEditingLookbookId(null);
      setIsEditingLookbook(false);
      toast.success('Лукбук обновлён!');
    } catch (error) {
      toast.error('Ошибка обновления лукбука');
    }
  };

  const handleDeleteLookbook = async (id: string) => {
    if (!confirm('Удалить лукбук?\n\nВсе фото из лукбука также будут удалены из хранилища.')) return;

    try {
      const response = await fetch(`${LOOKBOOKS_API}?id=${id}`, {
        method: 'DELETE',
        headers: {
          'X-User-Id': user.id
        }
      });

      if (!response.ok) throw new Error('Failed to delete lookbook');

      setLookbooks(prev => prev.filter(lb => lb.id !== id));
      toast.success('Лукбук удалён');
    } catch (error) {
      toast.error('Ошибка удаления лукбука');
    }
  };

  const handleShareToggle = async (lookbook: Lookbook) => {
    try {
      const newPublicState = !lookbook.is_public;
      
      const response = await fetch(LOOKBOOKS_API, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': user.id
        },
        body: JSON.stringify({
          id: lookbook.id,
          is_public: newPublicState
        })
      });

      if (!response.ok) throw new Error('Failed to update lookbook');
      
      const updatedLookbook = await response.json();
      
      setLookbooks(prev => prev.map(lb => 
        lb.id === lookbook.id ? updatedLookbook : lb
      ));

      if (newPublicState) {
        toast.success('Лукбук стал публичным');
      } else {
        toast.success('Лукбук стал приватным');
      }
    } catch (error) {
      toast.error('Ошибка изменения доступа');
    }
  };

  const copyShareLink = (token: string) => {
    const shareUrl = `${window.location.origin}/lookbook/${token}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success('Ссылка скопирована');
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <ProfileMenu />
          
          <div className="flex-1">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h1 className="text-3xl font-bold mb-2">Лукбуки</h1>
                <p className="text-muted-foreground">Управляйте своими лукбуками</p>
              </div>
              <Dialog open={isCreatingLookbook} onOpenChange={setIsCreatingLookbook}>
                <DialogTrigger asChild>
                  <Button>
                    <Icon name="Plus" size={16} className="mr-2" />
                    Создать лукбук
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Создать новый лукбук</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Название лукбука</label>
                      <Input 
                        value={newLookbookName}
                        onChange={(e) => setNewLookbookName(e.target.value)}
                        placeholder="Например: Весна 2024"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Для кого</label>
                      <Input 
                        value={newPersonName}
                        onChange={(e) => setNewPersonName(e.target.value)}
                        placeholder="Имя"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Загрузить фото</label>
                      <Input 
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handlePhotoUpload}
                      />
                    </div>
                    {selectedPhotos.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {selectedPhotos.map((photo, index) => (
                          <div key={index} className="relative group">
                            <img 
                              src={photo} 
                              alt={`Photo ${index + 1}`}
                              className="w-full h-32 object-cover rounded"
                            />
                            <button
                              onClick={() => setSelectedPhotos(prev => prev.filter((_, i) => i !== index))}
                              className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Icon name="X" size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <Button onClick={handleCreateLookbook} className="w-full">
                      Создать
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Icon name="Loader2" className="animate-spin" size={48} />
              </div>
            ) : lookbooks.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Icon name="Album" size={64} className="text-gray-300 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Нет лукбуков</h3>
                  <p className="text-muted-foreground mb-4">Создайте первый лукбук</p>
                  <Button onClick={() => setIsCreatingLookbook(true)}>
                    <Icon name="Plus" size={16} className="mr-2" />
                    Создать лукбук
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {lookbooks.map((lookbook) => (
                  <Card key={lookbook.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <div 
                      className="relative h-48 bg-gray-100 cursor-pointer"
                      onClick={() => setViewingLookbook(lookbook)}
                    >
                      {lookbook.photos.length > 0 ? (
                        <img 
                          src={lookbook.photos[0]} 
                          alt={lookbook.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Icon name="Image" size={48} className="text-gray-300" />
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                        <h3 className="text-white font-semibold">{lookbook.name}</h3>
                        <p className="text-white/80 text-sm">Для: {lookbook.person_name}</p>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
                        <span>{lookbook.photos.length} фото</span>
                        <span>{new Date(lookbook.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="flex-1"
                          onClick={() => setViewingLookbook(lookbook)}
                        >
                          <Icon name="Eye" size={16} className="mr-1" />
                          Открыть
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleEditLookbook(lookbook)}
                        >
                          <Icon name="Edit" size={16} />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDeleteLookbook(lookbook.id)}
                        >
                          <Icon name="Trash" size={16} />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {viewingLookbook && (
        <ImageViewer
          lookbook={viewingLookbook}
          onClose={() => setViewingLookbook(null)}
        />
      )}
    </Layout>
  );
}