import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import AdminMenu from '@/components/AdminMenu';
import ImageCropper from '@/components/ImageCropper';

interface ClothingItem {
  id: string;
  image_url: string;
  name: string;
  description: string;
  categories: string[];
  colors: string[];
  archetypes: string[];
  replicate_category?: string;
  gender?: string;
  created_at: string;
}

interface FilterOption {
  id: number | string;
  name: string;
}

interface Filters {
  categories: FilterOption[];
  colors: FilterOption[];
  archetypes: FilterOption[];
  genders: FilterOption[];
}

const CATALOG_API = 'https://functions.poehali.dev/e65f7df8-0a43-4921-8dbd-3dc0587255cc';
const IMAGE_PREPROCESSING_API = 'https://functions.poehali.dev/3fe8c892-ab5f-4d26-a2c5-ae4166276334';

export default function AdminCatalog() {
  const navigate = useNavigate();
  
  const [clothingItems, setClothingItems] = useState<ClothingItem[]>([]);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [showAddClothing, setShowAddClothing] = useState(false);
  const [selectedCatalogCategories, setSelectedCatalogCategories] = useState<number[]>([]);
  const [selectedCatalogColors, setSelectedCatalogColors] = useState<number[]>([]);
  const [selectedCatalogArchetypes, setSelectedCatalogArchetypes] = useState<number[]>([]);
  const [selectedCatalogGender, setSelectedCatalogGender] = useState<string>('');
  const [editingClothing, setEditingClothing] = useState<ClothingItem | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [newClothing, setNewClothing] = useState({
    image_url: '',
    name: '',
    description: '',
    category_ids: [] as number[],
    color_ids: [] as number[],
    archetype_ids: [] as number[],
    replicate_category: '' as string,
    gender: 'unisex' as string
  });
  const [showCropper, setShowCropper] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string>('');
  const [cropMode, setCropMode] = useState<'new' | 'edit'>('new');
  const [uploadSource, setUploadSource] = useState<'url' | 'file'>('url');

  useEffect(() => {
    const adminAuth = sessionStorage.getItem('admin_auth');
    if (!adminAuth) {
      navigate('/admin');
      return;
    }
    fetchCatalogData();
  }, [selectedCatalogCategories, selectedCatalogColors, selectedCatalogArchetypes, selectedCatalogGender, navigate]);

  const fetchCatalogData = async () => {
    try {
      const params = new URLSearchParams({ action: 'list' });
      if (selectedCatalogCategories.length > 0) {
        params.append('categories', selectedCatalogCategories.join(','));
      }
      if (selectedCatalogColors.length > 0) {
        params.append('colors', selectedCatalogColors.join(','));
      }
      if (selectedCatalogArchetypes.length > 0) {
        params.append('archetypes', selectedCatalogArchetypes.join(','));
      }
      if (selectedCatalogGender) {
        params.append('gender', selectedCatalogGender);
      }

      const [filtersRes, catalogRes] = await Promise.all([
        fetch(`${CATALOG_API}?action=filters`),
        fetch(`${CATALOG_API}?${params.toString()}`)
      ]);

      if (!filtersRes.ok || !catalogRes.ok) {
        throw new Error('Ошибка загрузки каталога');
      }

      const [filtersData, catalogData] = await Promise.all([
        filtersRes.json(),
        catalogRes.json()
      ]);

      setFilters(filtersData);
      setClothingItems(catalogData);
    } catch (error) {
      toast.error('Ошибка загрузки каталога');
    }
  };

  const handleRemoveBackground = async () => {
    if (!newClothing.image_url) {
      toast.error('Сначала загрузите изображение');
      return;
    }

    setIsProcessingImage(true);
    try {
      const response = await fetch(IMAGE_PREPROCESSING_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: newClothing.image_url })
      });

      if (!response.ok) throw new Error('Failed to remove background');
      
      const data = await response.json();
      setNewClothing(prev => ({ ...prev, image_url: data.processed_image }));
      toast.success('Фон удалён');
    } catch (error) {
      toast.error('Ошибка удаления фона');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleCropComplete = (croppedImage: string) => {
    if (cropMode === 'new') {
      setNewClothing({ ...newClothing, image_url: croppedImage });
    } else if (cropMode === 'edit' && editingClothing) {
      setEditingClothing({ ...editingClothing, image_url: croppedImage });
    }
    setShowCropper(false);
    toast.success('Изображение обрезано');
  };

  const handleAddClothing = async () => {
    if (!newClothing.image_url) {
      toast.error('Добавьте ссылку на изображение');
      return;
    }

    const adminPassword = sessionStorage.getItem('admin_auth');

    try {
      const response = await fetch(CATALOG_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': adminPassword || ''
        },
        body: JSON.stringify(newClothing)
      });

      if (response.ok) {
        toast.success('Одежда добавлена в каталог');
        setShowAddClothing(false);
        setNewClothing({
          image_url: '',
          name: '',
          description: '',
          category_ids: [],
          color_ids: [],
          archetype_ids: [],
          replicate_category: '',
          gender: 'unisex'
        });
        setUploadSource('url');
        fetchCatalogData();
      } else {
        toast.error('Ошибка добавления');
      }
    } catch (error) {
      toast.error('Ошибка добавления');
    }
  };

  const handleEditClothing = (item: ClothingItem) => {
    setEditingClothing(item);
  };

  const handleUpdateClothing = async () => {
    if (!editingClothing) return;

    const adminPassword = sessionStorage.getItem('admin_auth');

    try {
      const categoryIds = filters?.categories
        .filter(cat => editingClothing.categories.includes(cat.name))
        .map(cat => cat.id) || [];
      
      const colorIds = filters?.colors
        .filter(col => editingClothing.colors.includes(col.name))
        .map(col => col.id) || [];
      
      const archetypeIds = filters?.archetypes
        .filter(arch => editingClothing.archetypes.includes(arch.name))
        .map(arch => arch.id) || [];

      const response = await fetch(CATALOG_API, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': adminPassword || ''
        },
        body: JSON.stringify({
          id: editingClothing.id,
          image_url: editingClothing.image_url,
          name: editingClothing.name,
          description: editingClothing.description,
          category_ids: categoryIds,
          color_ids: colorIds,
          archetype_ids: archetypeIds,
          replicate_category: editingClothing.replicate_category || 'upper_body',
          gender: editingClothing.gender || 'unisex'
        })
      });

      if (response.ok) {
        toast.success('Одежда обновлена');
        setEditingClothing(null);
        fetchCatalogData();
      } else {
        toast.error('Ошибка обновления');
      }
    } catch (error) {
      toast.error('Ошибка обновления');
    }
  };

  const handleDeleteClothing = async (id: string) => {
    if (!confirm('Удалить эту позицию из каталога?')) return;

    const adminPassword = sessionStorage.getItem('admin_auth');

    try {
      const response = await fetch(`${CATALOG_API}?action=delete&id=${id}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Password': adminPassword || '' }
      });

      if (response.ok) {
        toast.success('Позиция удалена');
        fetchCatalogData();
      } else {
        toast.error('Ошибка удаления');
      }
    } catch (error) {
      toast.error('Ошибка удаления');
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <AdminMenu />
          
          <div className="flex-1">
            <div className="mb-8">
              <h1 className="text-3xl font-bold mb-2">Каталог</h1>
              <p className="text-muted-foreground">Управление каталогом одежды</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Каталог одежды ({clothingItems.length} позиций)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Filters */}
                  {filters && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Категории</label>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {filters.categories.map(cat => (
                            <label key={cat.id} className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedCatalogCategories.includes(Number(cat.id))}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedCatalogCategories([...selectedCatalogCategories, Number(cat.id)]);
                                  } else {
                                    setSelectedCatalogCategories(selectedCatalogCategories.filter(id => id !== Number(cat.id)));
                                  }
                                }}
                                className="rounded"
                              />
                              <span className="text-sm">{cat.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-2 block">Цвета</label>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {filters.colors.map(color => (
                            <label key={color.id} className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedCatalogColors.includes(Number(color.id))}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedCatalogColors([...selectedCatalogColors, Number(color.id)]);
                                  } else {
                                    setSelectedCatalogColors(selectedCatalogColors.filter(id => id !== Number(color.id)));
                                  }
                                }}
                                className="rounded"
                              />
                              <span className="text-sm">{color.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-2 block">Архетипы</label>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {filters.archetypes.map(arch => (
                            <label key={arch.id} className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedCatalogArchetypes.includes(Number(arch.id))}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedCatalogArchetypes([...selectedCatalogArchetypes, Number(arch.id)]);
                                  } else {
                                    setSelectedCatalogArchetypes(selectedCatalogArchetypes.filter(id => id !== Number(arch.id)));
                                  }
                                }}
                                className="rounded"
                              />
                              <span className="text-sm">{arch.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-2 block">Пол</label>
                        <select
                          value={selectedCatalogGender}
                          onChange={(e) => setSelectedCatalogGender(e.target.value)}
                          className="w-full p-2 border rounded"
                        >
                          <option value="">Все</option>
                          {filters.genders.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  <Button onClick={() => { setShowAddClothing(true); setEditingClothing(null); }}>
                    <Icon name="Plus" className="w-4 h-4 mr-2" />
                    Добавить одежду
                  </Button>

                  {(showAddClothing || editingClothing) && (
                    <Card className="p-4">
                      <h3 className="font-semibold mb-4">{editingClothing ? 'Редактировать одежду' : 'Добавить новую одежду'}</h3>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">Источник изображения</label>
                          <div className="flex gap-4">
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="radio"
                                checked={uploadSource === 'url'}
                                onChange={() => setUploadSource('url')}
                                className="rounded"
                              />
                              <span className="text-sm">URL</span>
                            </label>
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="radio"
                                checked={uploadSource === 'file'}
                                onChange={() => setUploadSource('file')}
                                className="rounded"
                              />
                              <span className="text-sm">Файл</span>
                            </label>
                          </div>
                        </div>

                        {uploadSource === 'url' ? (
                          <div>
                            <label className="text-sm font-medium mb-2 block">URL изображения</label>
                            <Input
                              placeholder="https://example.com/image.jpg"
                              value={editingClothing ? editingClothing.image_url : newClothing.image_url}
                              onChange={(e) => {
                                if (editingClothing) {
                                  setEditingClothing({ ...editingClothing, image_url: e.target.value });
                                } else {
                                  setNewClothing({ ...newClothing, image_url: e.target.value });
                                }
                              }}
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="text-sm font-medium mb-2 block">Загрузить изображение</label>
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    const base64String = reader.result as string;
                                    setImageToCrop(base64String);
                                    setCropMode(editingClothing ? 'edit' : 'new');
                                    setShowCropper(true);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </div>
                        )}

                        {(editingClothing?.image_url || newClothing.image_url) && (
                          <div>
                            <label className="text-sm font-medium mb-2 block">Превью</label>
                            <img 
                              src={editingClothing ? editingClothing.image_url : newClothing.image_url} 
                              alt="Preview" 
                              className="w-32 h-32 object-cover rounded"
                            />
                          </div>
                        )}

                        <div>
                          <label className="text-sm font-medium mb-2 block">Название</label>
                          <Input
                            placeholder="Название одежды"
                            value={editingClothing ? editingClothing.name : newClothing.name}
                            onChange={(e) => {
                              if (editingClothing) {
                                setEditingClothing({ ...editingClothing, name: e.target.value });
                              } else {
                                setNewClothing({ ...newClothing, name: e.target.value });
                              }
                            }}
                          />
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-2 block">Описание</label>
                          <Input
                            placeholder="Описание одежды"
                            value={editingClothing ? editingClothing.description : newClothing.description}
                            onChange={(e) => {
                              if (editingClothing) {
                                setEditingClothing({ ...editingClothing, description: e.target.value });
                              } else {
                                setNewClothing({ ...newClothing, description: e.target.value });
                              }
                            }}
                          />
                        </div>

                        {filters && (
                          <>
                            <div>
                              <label className="text-sm font-medium mb-2 block">Категории</label>
                              <div className="space-y-1 max-h-32 overflow-y-auto border rounded p-2">
                                {filters.categories.map(cat => {
                                  const isChecked = editingClothing 
                                    ? editingClothing.categories.includes(cat.name)
                                    : newClothing.category_ids.includes(Number(cat.id));
                                  
                                  return (
                                    <label key={cat.id} className="flex items-center space-x-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={(e) => {
                                          if (editingClothing) {
                                            if (e.target.checked) {
                                              setEditingClothing({
                                                ...editingClothing,
                                                categories: [...editingClothing.categories, cat.name]
                                              });
                                            } else {
                                              setEditingClothing({
                                                ...editingClothing,
                                                categories: editingClothing.categories.filter(c => c !== cat.name)
                                              });
                                            }
                                          } else {
                                            if (e.target.checked) {
                                              setNewClothing({
                                                ...newClothing,
                                                category_ids: [...newClothing.category_ids, Number(cat.id)]
                                              });
                                            } else {
                                              setNewClothing({
                                                ...newClothing,
                                                category_ids: newClothing.category_ids.filter(id => id !== Number(cat.id))
                                              });
                                            }
                                          }
                                        }}
                                        className="rounded"
                                      />
                                      <span className="text-sm">{cat.name}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>

                            <div>
                              <label className="text-sm font-medium mb-2 block">Цвета</label>
                              <div className="space-y-1 max-h-32 overflow-y-auto border rounded p-2">
                                {filters.colors.map(color => {
                                  const isChecked = editingClothing 
                                    ? editingClothing.colors.includes(color.name)
                                    : newClothing.color_ids.includes(Number(color.id));
                                  
                                  return (
                                    <label key={color.id} className="flex items-center space-x-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={(e) => {
                                          if (editingClothing) {
                                            if (e.target.checked) {
                                              setEditingClothing({
                                                ...editingClothing,
                                                colors: [...editingClothing.colors, color.name]
                                              });
                                            } else {
                                              setEditingClothing({
                                                ...editingClothing,
                                                colors: editingClothing.colors.filter(c => c !== color.name)
                                              });
                                            }
                                          } else {
                                            if (e.target.checked) {
                                              setNewClothing({
                                                ...newClothing,
                                                color_ids: [...newClothing.color_ids, Number(color.id)]
                                              });
                                            } else {
                                              setNewClothing({
                                                ...newClothing,
                                                color_ids: newClothing.color_ids.filter(id => id !== Number(color.id))
                                              });
                                            }
                                          }
                                        }}
                                        className="rounded"
                                      />
                                      <span className="text-sm">{color.name}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>

                            <div>
                              <label className="text-sm font-medium mb-2 block">Архетипы</label>
                              <div className="space-y-1 max-h-32 overflow-y-auto border rounded p-2">
                                {filters.archetypes.map(arch => {
                                  const isChecked = editingClothing 
                                    ? editingClothing.archetypes.includes(arch.name)
                                    : newClothing.archetype_ids.includes(Number(arch.id));
                                  
                                  return (
                                    <label key={arch.id} className="flex items-center space-x-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={(e) => {
                                          if (editingClothing) {
                                            if (e.target.checked) {
                                              setEditingClothing({
                                                ...editingClothing,
                                                archetypes: [...editingClothing.archetypes, arch.name]
                                              });
                                            } else {
                                              setEditingClothing({
                                                ...editingClothing,
                                                archetypes: editingClothing.archetypes.filter(a => a !== arch.name)
                                              });
                                            }
                                          } else {
                                            if (e.target.checked) {
                                              setNewClothing({
                                                ...newClothing,
                                                archetype_ids: [...newClothing.archetype_ids, Number(arch.id)]
                                              });
                                            } else {
                                              setNewClothing({
                                                ...newClothing,
                                                archetype_ids: newClothing.archetype_ids.filter(id => id !== Number(arch.id))
                                              });
                                            }
                                          }
                                        }}
                                        className="rounded"
                                      />
                                      <span className="text-sm">{arch.name}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          </>
                        )}

                        <div>
                          <label className="text-sm font-medium mb-2 block">Replicate категория</label>
                          <select
                            value={editingClothing ? editingClothing.replicate_category : newClothing.replicate_category}
                            onChange={(e) => {
                              if (editingClothing) {
                                setEditingClothing({ ...editingClothing, replicate_category: e.target.value });
                              } else {
                                setNewClothing({ ...newClothing, replicate_category: e.target.value });
                              }
                            }}
                            className="w-full p-2 border rounded"
                          >
                            <option value="">Выберите категорию</option>
                            <option value="upper_body">Верх (upper_body)</option>
                            <option value="lower_body">Низ (lower_body)</option>
                            <option value="dresses">Платья (dresses)</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-2 block">Пол</label>
                          <select
                            value={editingClothing ? editingClothing.gender : newClothing.gender}
                            onChange={(e) => {
                              if (editingClothing) {
                                setEditingClothing({ ...editingClothing, gender: e.target.value });
                              } else {
                                setNewClothing({ ...newClothing, gender: e.target.value });
                              }
                            }}
                            className="w-full p-2 border rounded"
                          >
                            <option value="unisex">Унисекс</option>
                            <option value="male">Мужской</option>
                            <option value="female">Женский</option>
                          </select>
                        </div>

                        <div className="flex gap-2">
                          {!editingClothing && (
                            <>
                              <Button
                                onClick={handleRemoveBackground}
                                disabled={isProcessingImage || !newClothing.image_url}
                                variant="outline"
                              >
                                {isProcessingImage ? 'Обработка...' : 'Удалить фон'}
                              </Button>
                              <Button
                                onClick={() => {
                                  if (newClothing.image_url) {
                                    setImageToCrop(newClothing.image_url);
                                    setCropMode('new');
                                    setShowCropper(true);
                                  } else {
                                    toast.error('Сначала добавьте изображение');
                                  }
                                }}
                                variant="outline"
                              >
                                <Icon name="Crop" className="w-4 h-4 mr-2" />
                                Обрезать
                              </Button>
                            </>
                          )}
                          {editingClothing && (
                            <Button
                              onClick={() => {
                                if (editingClothing.image_url) {
                                  setImageToCrop(editingClothing.image_url);
                                  setCropMode('edit');
                                  setShowCropper(true);
                                } else {
                                  toast.error('Сначала добавьте изображение');
                                }
                              }}
                              variant="outline"
                            >
                              <Icon name="Crop" className="w-4 h-4 mr-2" />
                              Обрезать
                            </Button>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Button onClick={editingClothing ? handleUpdateClothing : handleAddClothing}>
                            {editingClothing ? 'Сохранить изменения' : 'Добавить'}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setShowAddClothing(false);
                              setEditingClothing(null);
                              setNewClothing({
                                image_url: '',
                                name: '',
                                description: '',
                                category_ids: [],
                                color_ids: [],
                                archetype_ids: [],
                                replicate_category: '',
                                gender: 'unisex'
                              });
                              setUploadSource('url');
                            }}
                          >
                            Отмена
                          </Button>
                        </div>
                      </div>
                    </Card>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {clothingItems.map((item) => (
                      <Card key={item.id} className="overflow-hidden">
                        <div className="aspect-square relative">
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <CardContent className="p-4">
                          <h3 className="font-semibold mb-1 truncate">{item.name}</h3>
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{item.description}</p>
                          
                          <div className="space-y-2 text-xs">
                            {item.categories.length > 0 && (
                              <div>
                                <span className="font-medium">Категории: </span>
                                <span className="text-muted-foreground">{item.categories.join(', ')}</span>
                              </div>
                            )}
                            {item.colors.length > 0 && (
                              <div>
                                <span className="font-medium">Цвета: </span>
                                <span className="text-muted-foreground">{item.colors.join(', ')}</span>
                              </div>
                            )}
                            {item.archetypes.length > 0 && (
                              <div>
                                <span className="font-medium">Архетипы: </span>
                                <span className="text-muted-foreground">{item.archetypes.join(', ')}</span>
                              </div>
                            )}
                            {item.replicate_category && (
                              <div>
                                <span className="font-medium">Replicate: </span>
                                <span className="text-muted-foreground">{item.replicate_category}</span>
                              </div>
                            )}
                            {item.gender && (
                              <div>
                                <span className="font-medium">Пол: </span>
                                <span className="text-muted-foreground">{item.gender}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2 mt-4">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditClothing(item)}
                            >
                              <Icon name="Pencil" className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteClothing(item.id)}
                            >
                              <Icon name="Trash2" className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {clothingItems.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Icon name="Package" size={48} className="mx-auto mb-4 opacity-50" />
                      <p>Каталог пуст. Добавьте первую позицию.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {showCropper && imageToCrop && (
        <ImageCropper
          imageUrl={imageToCrop}
          onCropComplete={handleCropComplete}
          onCancel={() => setShowCropper(false)}
        />
      )}
    </Layout>
  );
}
