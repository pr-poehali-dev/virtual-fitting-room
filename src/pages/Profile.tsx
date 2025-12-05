import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';
import ImageViewer from '@/components/ImageViewer';
import ImageCropper from '@/components/ImageCropper';
import WalletTab from '@/components/WalletTab';
import HistoryTab from '@/components/HistoryTab';
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
const HISTORY_API = 'https://functions.poehali.dev/8436b2bf-ae39-4d91-b2b7-91951b4235cd';
const CHANGE_PASSWORD_API = 'https://functions.poehali.dev/98400760-4d03-4ca8-88ab-753fde19ef83';
const UPDATE_PROFILE_API = 'https://functions.poehali.dev/efb92b0f-c34a-4b12-ad41-744260d1173a';
const DELETE_ACCOUNT_API = 'https://functions.poehali.dev/d8626da4-6372-40c1-abba-d4ffdc89c7c4';
const IMAGE_PREPROCESSING_API = 'https://functions.poehali.dev/3fe8c892-ab5f-4d26-a2c5-ae4166276334';

export default function Profile() {
  const { user, isLoading: authLoading, updateUser, logout } = useAuth();
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
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
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
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const userData = JSON.parse(storedUser);
        if (!userData.email_verified) {
          toast.error('Email не подтвержден. Проверьте почту.');
          logout();
          navigate('/login');
          return;
        }
      }
      
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
      
      // Добавляем новый лукбук в список мгновенно
      setLookbooks(prev => [newLookbook, ...prev]);
      
      // Также делаем fetch для синхронизации с сервером
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
      
      // Обновляем список лукбуков сразу после редактирования
      setLookbooks(prev => prev.map(lb => 
        lb.id === editingLookbookId 
          ? { ...lb, name: newLookbookName, person_name: newPersonName, photos: selectedPhotos, color_palette: colorPalette, updated_at: new Date().toISOString() }
          : lb
      ));
      
      // Также делаем fetch для синхронизации с сервером
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
      
      toast.success('Лукбук удалён');
      
      // Обновляем список лукбуков сразу после удаления
      setLookbooks(prev => prev.filter(lb => lb.id !== id));
      
      // Также делаем fetch для синхронизации с сервером
      fetchLookbooks().catch(() => {}); // Игнорируем ошибки обновления списка
    } catch (error) {
      toast.error('Ошибка удаления лукбука');
    }
  };

  const handleViewLookbook = (lookbook: Lookbook) => {
    setViewingLookbook(lookbook);
  };

  const handleDownloadPDF = async () => {
    if (!viewingLookbook) return;
    
    setIsGeneratingPDF(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const usableWidth = pageWidth - 2 * margin;
      
      const encodeText = (text: string) => {
        const chars: { [key: string]: string } = {
          'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'Yo', 'Ж': 'Zh',
          'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O',
          'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts',
          'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch', 'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya',
          'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
          'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
          'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
          'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
        };
        return text.split('').map(char => chars[char] || char).join('');
      };
      
      pdf.setFontSize(24);
      pdf.text(encodeText(viewingLookbook.name), margin, margin + 10);
      
      pdf.setFontSize(14);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`For: ${encodeText(viewingLookbook.person_name)}`, margin, margin + 20);
      
      let yPos = margin + 35;
      
      const colorSize = 8;
      viewingLookbook.color_palette.forEach((color, i) => {
        pdf.setFillColor(parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16));
        pdf.rect(margin + i * (colorSize + 2), yPos, colorSize, colorSize, 'F');
      });
      
      yPos += 20;
      
      const loadImage = (url: string): Promise<string> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
          };
          img.onerror = reject;
          img.src = url;
        });
      };
      
      const photos = viewingLookbook.photos;
      const cellWidth = usableWidth / 3;
      const gap = 3;
      const imageWidth = cellWidth - gap;
      const imageHeight = imageWidth * 1.4;
      
      let currentX = margin;
      let currentY = yPos;
      let photosInRow = 0;
      
      for (let i = 0; i < photos.length; i++) {
        if (currentY + imageHeight > pageHeight - margin) {
          pdf.addPage();
          currentY = margin;
          currentX = margin;
          photosInRow = 0;
        }
        
        try {
          const imgData = await loadImage(photos[i]);
          pdf.addImage(imgData, 'JPEG', currentX, currentY, imageWidth, imageHeight, undefined, 'FAST');
        } catch (e) {
          console.error('Failed to load image:', e);
        }
        
        photosInRow++;
        
        if (photosInRow === 3) {
          currentX = margin;
          currentY += imageHeight + gap;
          photosInRow = 0;
        } else {
          currentX += cellWidth;
        }
      }
      
      pdf.save(`${encodeText(viewingLookbook.name)}.pdf`);
      toast.success('PDF скачан!');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Ошибка создания PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleAddColor = () => {
    const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16);
    setColorPalette(prev => [...prev, randomColor]);
  };

  const handleRemoveColor = (index: number) => {
    setColorPalette(prev => prev.filter((_, i) => i !== index));
  };

  const handleCropPhoto = (index: number) => {
    setCurrentPhotoIndex(index);
    setImageToCrop(selectedPhotos[index]);
    setShowCropper(true);
  };

  const handleCropComplete = (croppedImage: string) => {
    if (currentPhotoIndex !== null) {
      const updatedPhotos = [...selectedPhotos];
      updatedPhotos[currentPhotoIndex] = croppedImage;
      setSelectedPhotos(updatedPhotos);
    }
    setShowCropper(false);
    setCurrentPhotoIndex(null);
    toast.success('Изображение обрезано');
  };

  const handleRemoveBackground = async (index: number) => {
    const photo = selectedPhotos[index];
    if (!photo) return;

    setIsProcessingImage(true);
    try {
      const response = await fetch(IMAGE_PREPROCESSING_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: photo })
      });

      if (!response.ok) throw new Error('Failed to remove background');
      
      const data = await response.json();
      const updatedPhotos = [...selectedPhotos];
      updatedPhotos[index] = data.processed_image;
      setSelectedPhotos(updatedPhotos);
      toast.success('Фон удалён');
    } catch (error) {
      toast.error('Ошибка удаления фона');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      toast.error('Заполните все поля');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Пароль должен быть не менее 6 символов');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast.error('Новые пароли не совпадают');
      return;
    }

    try {
      const response = await fetch(CHANGE_PASSWORD_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': user.id
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Пароль успешно изменён');
        setIsChangingPassword(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      } else {
        toast.error(data.error || 'Ошибка при смене пароля');
      }
    } catch (error) {
      toast.error('Ошибка соединения с сервером');
    }
  };

  const handleUpdateName = async () => {
    if (!editedName.trim()) {
      toast.error('Введите имя');
      return;
    }

    try {
      const response = await fetch(UPDATE_PROFILE_API, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': user.id
        },
        body: JSON.stringify({
          name: editedName
        })
      });

      const data = await response.json();

      if (response.ok) {
        updateUser(data);
        toast.success('Имя успешно изменено');
        setIsEditingName(false);
      } else {
        toast.error(data.error || 'Ошибка при изменении имени');
      }
    } catch (error) {
      toast.error('Ошибка соединения с сервером');
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'Вы уверены, что хотите удалить аккаунт?\n\nЭто действие нельзя отменить. Все ваши данные (лукбуки, история примерок) будут удалены безвозвратно.'
    );

    if (!confirmed) return;

    const doubleConfirm = window.confirm(
      'Последнее предупреждение!\n\nВы действительно хотите удалить аккаунт навсегда?'
    );

    if (!doubleConfirm) return;

    try {
      const response = await fetch(DELETE_ACCOUNT_API, {
        method: 'DELETE',
        headers: {
          'X-User-Id': user.id
        }
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Аккаунт успешно удалён');
        logout();
        navigate('/');
      } else {
        toast.error(data.error || 'Ошибка при удалении аккаунта');
      }
    } catch (error) {
      toast.error('Ошибка соединения с сервером');
    }
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
            <TabsList className="grid w-full md:w-auto grid-cols-4 mb-8">
              <TabsTrigger value="lookbooks">Лукбуки</TabsTrigger>
              <TabsTrigger value="history">История</TabsTrigger>
              <TabsTrigger value="wallet">Кошелёк</TabsTrigger>
              <TabsTrigger value="settings">Настройки</TabsTrigger>
            </TabsList>

            <TabsContent value="lookbooks">
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-light">Мои лукбуки</h3>
                  <Dialog open={isCreatingLookbook || isEditingLookbook} onOpenChange={(open) => {
                    if (!open) {
                      setIsCreatingLookbook(false);
                      setIsEditingLookbook(false);
                      setEditingLookbookId(null);
                      setNewLookbookName('');
                      setNewPersonName('');
                      setSelectedPhotos([]);
                      setColorPalette(['#FF6B6B', '#4ECDC4', '#45B7D1']);
                      setSelectedPhotoIndexes([]);
                      setTargetLookbookId('');
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button onClick={() => setIsCreatingLookbook(true)}>
                        <Icon name="Plus" className="mr-2" size={18} />
                        Создать лукбук
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>{isEditingLookbook ? 'Редактировать лукбук' : 'Новый лукбук'}</DialogTitle>
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

                        {selectedPhotos.length > 0 && (
                          <div>
                            <label className="block text-sm font-medium mb-2">Результаты примерок</label>
                            <div className="grid grid-cols-3 gap-3 mb-4">
                              {selectedPhotos.map((photo, index) => (
                                <div key={index} className="relative group border rounded-lg overflow-hidden bg-muted aspect-[5/7]">
                                  <ImageViewer src={photo} alt="" className="w-full h-full object-contain" />
                                  <div className="absolute bottom-2 left-2" title="Выберите фото для переноса в другой лукбук">
                                    <input
                                      type="checkbox"
                                      checked={selectedPhotoIndexes.includes(index)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedPhotoIndexes([...selectedPhotoIndexes, index]);
                                        } else {
                                          setSelectedPhotoIndexes(selectedPhotoIndexes.filter(i => i !== index));
                                        }
                                      }}
                                      className="w-5 h-5 cursor-pointer"
                                      title="Выберите фото для переноса в другой лукбук"
                                    />
                                  </div>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="destructive"
                                    className="absolute top-2 right-2 h-8 w-8 p-0 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => {
                                      if (confirm('Удалить фото из лукбука?')) {
                                        setSelectedPhotos(selectedPhotos.filter((_, i) => i !== index));
                                      }
                                    }}
                                    title="Удалить фото"
                                  >
                                    <Icon name="X" size={14} />
                                  </Button>
                                </div>
                              ))}
                            </div>
                            {isEditingLookbook && selectedPhotoIndexes.length > 0 && (
                              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                                <label className="block text-sm font-medium">Перенос фото в другой лукбук</label>
                                <div className="flex gap-2">
                                  <Select value={targetLookbookId} onValueChange={setTargetLookbookId}>
                                    <SelectTrigger className="flex-1">
                                      <SelectValue placeholder="Выберите лукбук" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {lookbooks
                                        .filter(lb => lb.id !== editingLookbookId)
                                        .map(lb => (
                                          <SelectItem key={lb.id} value={lb.id}>
                                            {lb.name}
                                          </SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    type="button"
                                    variant="default"
                                    size="icon"
                                    onClick={async () => {
                                      if (!targetLookbookId) {
                                        toast.error('Выберите лукбук');
                                        return;
                                      }
                                      const photosToMove = selectedPhotoIndexes.map(i => selectedPhotos[i]);
                                      const targetLookbook = lookbooks.find(lb => lb.id === targetLookbookId);
                                      if (!targetLookbook) return;
                                      
                                      const updatedSourcePhotos = selectedPhotos.filter((_, i) => !selectedPhotoIndexes.includes(i));
                                      
                                      try {
                                        await fetch(LOOKBOOKS_API, {
                                          method: 'PUT',
                                          headers: {
                                            'Content-Type': 'application/json',
                                            'X-User-Id': user.id
                                          },
                                          body: JSON.stringify({
                                            id: targetLookbookId,
                                            name: targetLookbook.name,
                                            person_name: targetLookbook.person_name,
                                            photos: [...targetLookbook.photos, ...photosToMove],
                                            color_palette: targetLookbook.color_palette
                                          })
                                        });
                                        
                                        await fetch(LOOKBOOKS_API, {
                                          method: 'PUT',
                                          headers: {
                                            'Content-Type': 'application/json',
                                            'X-User-Id': user.id
                                          },
                                          body: JSON.stringify({
                                            id: editingLookbookId,
                                            name: newLookbookName,
                                            person_name: newPersonName,
                                            photos: updatedSourcePhotos,
                                            color_palette: colorPalette
                                          })
                                        });
                                        
                                        // Обновляем список лукбуков мгновенно
                                        setLookbooks(prev => prev.map(lb => {
                                          if (lb.id === targetLookbookId) {
                                            return { ...lb, photos: [...lb.photos, ...photosToMove], updated_at: new Date().toISOString() };
                                          }
                                          if (lb.id === editingLookbookId) {
                                            return { ...lb, photos: updatedSourcePhotos, updated_at: new Date().toISOString() };
                                          }
                                          return lb;
                                        }));
                                        
                                        setSelectedPhotos(updatedSourcePhotos);
                                        setSelectedPhotoIndexes([]);
                                        setTargetLookbookId('');
                                        
                                        // Также делаем fetch для синхронизации с сервером
                                        await fetchLookbooks();
                                        
                                        toast.success('Фото перенесены!');
                                      } catch (error) {
                                        toast.error('Ошибка переноса фото');
                                      }
                                    }}
                                    disabled={!targetLookbookId}
                                    title="Перенести фото"
                                  >
                                    <Icon name="ArrowRight" size={20} />
                                  </Button>
                                </div>
                                <p className="text-xs text-blue-700">
                                  {targetLookbookId 
                                    ? `Выбрано ${selectedPhotoIndexes.length} фото. Нажмите на кнопку со стрелкой для переноса`
                                    : `Выбрано ${selectedPhotoIndexes.length} фото. Выберите лукбук для переноса`
                                  }
                                </p>
                              </div>
                            )}
                          </div>
                        )}

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

                        <Button onClick={isEditingLookbook ? handleUpdateLookbook : handleCreateLookbook} className="w-full">
                          {isEditingLookbook ? 'Обновить лукбук' : 'Создать лукбук'}
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
                              <p className="text-sm text-muted-foreground mt-1">Для: {lookbook.person_name}</p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewLookbook(lookbook)}
                                title="Просмотр"
                              >
                                <Icon name="Eye" size={16} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditLookbook(lookbook)}
                                title="Редактировать"
                              >
                                <Icon name="Edit" size={16} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteLookbook(lookbook.id)}
                                title="Удалить"
                              >
                                <Icon name="Trash2" size={16} />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {lookbook.photos.length > 0 && (
                            <div className="grid grid-cols-3 gap-2 mb-4">
                              {lookbook.photos.slice(0, 3).map((photo, index) => (
                                <ImageViewer key={index} src={photo} alt="" className="w-full h-20 object-contain bg-muted rounded" />
                              ))}
                            </div>
                          )}
                          <div className="flex gap-2">
                            {lookbook.color_palette.slice(0, 5).map((color, index) => (
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
              <HistoryTab userId={user.id} />
            </TabsContent>

            <TabsContent value="wallet">
              <WalletTab />
            </TabsContent>

            <TabsContent value="settings">
              <div className="space-y-6">
                <h3 className="text-2xl font-light">Настройки аккаунта</h3>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Информация профиля</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Имя</p>
                      {isEditingName ? (
                        <div className="flex gap-2">
                          <Input
                            value={editedName}
                            onChange={(e) => setEditedName(e.target.value)}
                            placeholder="Введите имя"
                          />
                          <Button onClick={handleUpdateName}>
                            <Icon name="Check" size={18} />
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setIsEditingName(false);
                              setEditedName('');
                            }}
                          >
                            <Icon name="X" size={18} />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{user.name}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditedName(user.name);
                              setIsEditingName(true);
                            }}
                          >
                            <Icon name="Edit" size={16} className="mr-2" />
                            Изменить
                          </Button>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium text-muted-foreground">{user.email}</p>
                      <p className="text-xs text-muted-foreground mt-1">Email нельзя изменить</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Смена пароля</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isChangingPassword ? (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            Текущий пароль
                          </label>
                          <Input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Введите текущий пароль"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            Новый пароль
                          </label>
                          <Input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Минимум 6 символов"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-2">
                            Подтвердите новый пароль
                          </label>
                          <Input
                            type="password"
                            value={confirmNewPassword}
                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                            placeholder="Повторите новый пароль"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={handleChangePassword}>
                            <Icon name="Lock" className="mr-2" size={18} />
                            Сохранить пароль
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setIsChangingPassword(false);
                              setCurrentPassword('');
                              setNewPassword('');
                              setConfirmNewPassword('');
                            }}
                          >
                            Отмена
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button onClick={() => setIsChangingPassword(true)}>
                        <Icon name="Key" className="mr-2" size={18} />
                        Изменить пароль
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-destructive">
                  <CardHeader>
                    <CardTitle className="text-destructive">Опасная зона</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">
                          Удаление аккаунта навсегда удалит все ваши данные:
                        </p>
                        <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                          <li>Все лукбуки</li>
                          <li>История примерок</li>
                          <li>Настройки профиля</li>
                        </ul>
                        <p className="text-sm text-destructive font-medium mt-3">
                          Это действие нельзя отменить!
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        onClick={handleDeleteAccount}
                      >
                        <Icon name="Trash2" className="mr-2" size={18} />
                        Удалить аккаунт
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {showCropper && imageToCrop && (
        <ImageCropper
          image={imageToCrop}
          open={showCropper}
          onClose={() => {
            setShowCropper(false);
            setCurrentPhotoIndex(null);
          }}
          onCropComplete={handleCropComplete}
        />
      )}

      <Dialog open={!!viewingLookbook} onOpenChange={(open) => !open && setViewingLookbook(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-light">{viewingLookbook?.name}</h2>
                <p className="text-sm text-muted-foreground mt-1">Для: {viewingLookbook?.person_name}</p>
              </div>
              <Button 
                onClick={handleDownloadPDF} 
                disabled={isGeneratingPDF}
                size="sm"
              >
                {isGeneratingPDF ? (
                  <>
                    <Icon name="Loader2" className="mr-2 animate-spin" size={16} />
                    Создание PDF...
                  </>
                ) : (
                  <>
                    <Icon name="Download" className="mr-2" size={16} />
                    Скачать PDF
                  </>
                )}
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          {viewingLookbook && (
            <div className="space-y-6 py-4">
              <div>
                <h3 className="text-sm font-medium mb-3">Цветовая палитра</h3>
                <div className="flex gap-3 flex-wrap">
                  {viewingLookbook.color_palette.map((color, index) => (
                    <div
                      key={index}
                      className="w-14 h-14 rounded-lg shadow-md"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              {viewingLookbook.photos.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-3">Результаты примерок</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {viewingLookbook.photos.map((photo, index) => (
                      <div key={index} className="relative rounded-lg overflow-hidden bg-muted aspect-[5/7]">
                        <ImageViewer 
                          src={photo} 
                          alt={`Photo ${index + 1}`}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}