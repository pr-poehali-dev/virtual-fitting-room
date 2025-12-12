import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import AdminMenu from '@/components/AdminMenu';
import ImageCropper from '@/components/ImageCropper';
import CatalogFilters from '@/components/admin/CatalogFilters';
import CatalogItemForm from '@/components/admin/CatalogItemForm';
import {
  fetchCatalogData,
  removeBackground,
  addClothing,
  updateClothing,
  deleteClothing,
} from '@/utils/adminCatalogApi';

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
  const [uploadSource, setUploadSource] = useState<'url' | 'file'>('url');

  useEffect(() => {
    const adminAuth = sessionStorage.getItem('admin_auth');
    if (!adminAuth) {
      navigate('/admin');
      return;
    }
    loadCatalogData();
  }, [selectedCatalogCategories, selectedCatalogColors, selectedCatalogArchetypes, selectedCatalogGender, navigate]);

  const loadCatalogData = async () => {
    const data = await fetchCatalogData(
      selectedCatalogCategories,
      selectedCatalogColors,
      selectedCatalogArchetypes,
      selectedCatalogGender
    );
    if (data) {
      setFilters(data.filters);
      setClothingItems(data.catalog);
    }
  };

  const handleRemoveBackground = async () => {
    if (!newClothing.image_url) {
      toast.error('Сначала загрузите изображение');
      return;
    }

    setIsProcessingImage(true);
    const processedImage = await removeBackground(newClothing.image_url);
    setIsProcessingImage(false);
    
    if (processedImage) {
      setNewClothing(prev => ({ ...prev, image_url: processedImage }));
    }
  };

  const handleCropComplete = (croppedImage: string) => {
    setNewClothing(prev => ({ ...prev, image_url: croppedImage }));
    setShowCropper(false);
    setImageToCrop('');
    toast.success('Изображение обрезано');
  };

  const handleAddClothing = async () => {
    const success = await addClothing(newClothing);
    if (success) {
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
      loadCatalogData();
    }
  };

  const handleEditClothing = (item: ClothingItem) => {
    setEditingClothing(item);
  };

  const handleUpdateClothing = async () => {
    if (!editingClothing) return;

    const success = await updateClothing(editingClothing, filters);
    if (success) {
      setEditingClothing(null);
      loadCatalogData();
    }
  };

  const handleDeleteClothing = async (id: string) => {
    const success = await deleteClothing(id);
    if (success) {
      loadCatalogData();
    }
  };

  const handleCancelForm = () => {
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
  };

  const handleCropImage = () => {
    if (newClothing.image_url) {
      setImageToCrop(newClothing.image_url);
      setShowCropper(true);
    } else {
      toast.error('Сначала добавьте изображение');
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
                  <CatalogFilters
                    filters={filters}
                    selectedCatalogCategories={selectedCatalogCategories}
                    setSelectedCatalogCategories={setSelectedCatalogCategories}
                    selectedCatalogColors={selectedCatalogColors}
                    setSelectedCatalogColors={setSelectedCatalogColors}
                    selectedCatalogArchetypes={selectedCatalogArchetypes}
                    setSelectedCatalogArchetypes={setSelectedCatalogArchetypes}
                    selectedCatalogGender={selectedCatalogGender}
                    setSelectedCatalogGender={setSelectedCatalogGender}
                  />

                  <Button onClick={() => { setShowAddClothing(true); setEditingClothing(null); }}>
                    <Icon name="Plus" className="w-4 h-4 mr-2" />
                    Добавить одежду
                  </Button>

                  {(showAddClothing || editingClothing) && (
                    <CatalogItemForm
                      editingClothing={editingClothing}
                      setEditingClothing={setEditingClothing}
                      newClothing={newClothing}
                      setNewClothing={setNewClothing}
                      filters={filters}
                      isProcessingImage={isProcessingImage}
                      uploadSource={uploadSource}
                      setUploadSource={setUploadSource}
                      onRemoveBackground={handleRemoveBackground}
                      onCropImage={handleCropImage}
                      onSubmit={editingClothing ? handleUpdateClothing : handleAddClothing}
                      onCancel={handleCancelForm}
                    />
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

      <ImageCropper
        image={imageToCrop}
        open={showCropper}
        onClose={() => {
          setShowCropper(false);
          setImageToCrop('');
        }}
        onCropComplete={handleCropComplete}
        aspectRatio={3 / 4}
      />
    </Layout>
  );
}
