import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { useAuth } from '@/context/AuthContext';
import VirtualFittingControls from '@/components/VirtualFittingControls';
import VirtualFittingResult from '@/components/VirtualFittingResult';
import VirtualFittingInfo from '@/components/VirtualFittingInfo';
import { fetchFilters, fetchCatalog, fetchLookbooks } from '@/components/index/IndexDataFetchers';
import { checkAndDeductBalance } from '@/components/index/IndexBalanceCheck';
import { saveToExistingLookbook, saveToNewLookbook } from '@/components/index/IndexLookbookActions';
import { continuePolling, handleGenerate as generateImage } from '@/components/index/IndexGenerationLogic';

interface ClothingItem {
  id: string;
  image_url: string;
  name: string;
  description: string;
  categories: string[];
  colors: string[];
  archetypes: string[];
}

interface FilterOption {
  id: number;
  name: string;
}

interface Filters {
  categories: FilterOption[];
  colors: FilterOption[];
  archetypes: FilterOption[];
}

interface SelectedClothing {
  id: string;
  image: string;
  name?: string;
  categories: string[];
}

export default function OldTryOn() {
  const { user } = useAuth();
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [selectedClothing, setSelectedClothing] = useState<SelectedClothing | null>(null);
  const [clothingCatalog, setClothingCatalog] = useState<ClothingItem[]>([]);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [selectedColors, setSelectedColors] = useState<number[]>([]);
  const [selectedArchetypes, setSelectedArchetypes] = useState<number[]>([]);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [lookbooks, setLookbooks] = useState<any[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newLookbookName, setNewLookbookName] = useState('');
  const [newLookbookPersonName, setNewLookbookPersonName] = useState('');
  const [selectedLookbookId, setSelectedLookbookId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const pendingGeneration = localStorage.getItem('pendingGeneration');
    if (pendingGeneration) {
      const data = JSON.parse(pendingGeneration);
      setUploadedImage(data.uploadedImage);
      setIsGenerating(true);
      continuePolling(
        data.statusUrl, 
        data.uploadedImage, 
        data.garmentImage,
        user,
        setLoadingProgress,
        setGeneratedImage,
        setIsGenerating
      );
    }

    if (user) {
      fetchLookbooksWrapper();
    }
    
    fetchFilters(setFilters);
    fetchCatalogWrapper();
  }, [user]);
  
  useEffect(() => {
    fetchCatalogWrapper();
  }, [selectedCategories, selectedColors, selectedArchetypes]);
  
  const fetchCatalogWrapper = () => {
    fetchCatalog(selectedCategories, selectedColors, selectedArchetypes, setClothingCatalog);
  };
  
  const fetchLookbooksWrapper = async () => {
    await fetchLookbooks(user?.id, setLookbooks);
  };

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
    if (!file) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      const id = `custom-${Date.now()}`;
      setSelectedClothing({
        id,
        image: reader.result as string,
        name: file.name,
        categories: []
      });
    };
    reader.readAsDataURL(file);
    
    e.target.value = '';
  };

  const handleCancelGeneration = () => {
    if (abortController) {
      abortController.abort();
      setIsGenerating(false);
      setLoadingProgress(0);
      setAbortController(null);
      localStorage.removeItem('pendingGeneration');
    }
  };

  const handleSaveToExistingLookbook = async () => {
    await saveToExistingLookbook(
      selectedLookbookId,
      generatedImage,
      user,
      lookbooks,
      setIsSaving,
      setShowSaveDialog,
      setSelectedLookbookId,
      fetchLookbooksWrapper
    );
  };

  const handleSaveToNewLookbook = async () => {
    await saveToNewLookbook(
      newLookbookName,
      newLookbookPersonName,
      generatedImage,
      user,
      setIsSaving,
      setShowSaveDialog,
      setNewLookbookName,
      setNewLookbookPersonName,
      fetchLookbooksWrapper
    );
  };

  const handleDownloadImage = async () => {
    if (!generatedImage) return;

    try {
      const response = await fetch(generatedImage);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `virtual-fitting-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Изображение скачано!');
    } catch (error) {
      toast.error('Ошибка скачивания');
    }
  };

  const handleReset = () => {
    setUploadedImage(null);
    setSelectedClothing(null);
    setGeneratedImage(null);
    localStorage.removeItem('pendingGeneration');
  };
  
  const toggleClothingSelection = (item: ClothingItem) => {
    if (selectedClothing?.id === item.id) {
      setSelectedClothing(null);
    } else {
      setSelectedClothing({
        id: item.id,
        image: item.image_url,
        name: item.name,
        categories: item.categories
      });
    }
  };

  const handleGenerate = async () => {
    const balanceCheckPassed = await checkAndDeductBalance(user);
    
    if (!balanceCheckPassed) {
      return;
    }

    await generateImage(
      user,
      uploadedImage,
      selectedClothing,
      balanceCheckPassed,
      setAbortController,
      setIsGenerating,
      setLoadingProgress,
      setGeneratedImage
    );
  };

  return (
    <Layout>
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-16 animate-fade-in">
            <h2 className="text-5xl md:text-6xl font-light mb-4">
              Старая примерочная
            </h2>
            <p className="text-muted-foreground text-lg">
              Это старая версия примерочной (fal.ai)
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-start">
            <VirtualFittingControls
              uploadedImage={uploadedImage}
              handleImageUpload={handleImageUpload}
              selectedClothing={selectedClothing}
              clothingCatalog={clothingCatalog}
              filters={filters}
              selectedCategories={selectedCategories}
              selectedColors={selectedColors}
              selectedArchetypes={selectedArchetypes}
              setSelectedCategories={setSelectedCategories}
              setSelectedColors={setSelectedColors}
              setSelectedArchetypes={setSelectedArchetypes}
              toggleClothingSelection={toggleClothingSelection}
              setSelectedClothing={setSelectedClothing}
              handleCustomClothingUpload={handleCustomClothingUpload}
              handleGenerate={handleGenerate}
              isGenerating={isGenerating}
              loadingProgress={loadingProgress}
              handleCancelGeneration={handleCancelGeneration}
            />

            <VirtualFittingResult
              isGenerating={isGenerating}
              generatedImage={generatedImage}
              handleSaveToLookbook={() => setShowSaveDialog(true)}
              handleDownloadImage={handleDownloadImage}
              handleReset={handleReset}
              showSaveDialog={showSaveDialog}
              setShowSaveDialog={setShowSaveDialog}
              newLookbookName={newLookbookName}
              setNewLookbookName={setNewLookbookName}
              newLookbookPersonName={newLookbookPersonName}
              setNewLookbookPersonName={setNewLookbookPersonName}
              lookbooks={lookbooks}
              selectedLookbookId={selectedLookbookId}
              setSelectedLookbookId={setSelectedLookbookId}
              handleSaveToExistingLookbook={handleSaveToExistingLookbook}
              handleSaveToNewLookbook={handleSaveToNewLookbook}
              isSaving={isSaving}
            />
          </div>

          <VirtualFittingInfo />
        </div>
      </section>
    </Layout>
  );
}
