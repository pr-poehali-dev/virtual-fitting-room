import { toast } from 'sonner';

interface FilterOption {
  id: number;
  name: string;
}

interface Filters {
  categories: FilterOption[];
  colors: FilterOption[];
  archetypes: FilterOption[];
}

interface ClothingItem {
  id: string;
  image_url: string;
  name: string;
  description: string;
  categories: string[];
  colors: string[];
  archetypes: string[];
}

const CATALOG_API = 'https://functions.poehali.dev/e65f7df8-0a43-4921-8dbd-3dc0587255cc';

export const fetchFilters = async (
  setFilters: (filters: Filters) => void
) => {
  try {
    const response = await fetch(`${CATALOG_API}?action=filters`);
    if (response.ok) {
      const data = await response.json();
      setFilters(data);
    }
  } catch (error) {
    console.error('Failed to fetch filters:', error);
  }
};

export const fetchCatalog = async (
  selectedCategories: number[],
  selectedColors: number[],
  selectedArchetypes: number[],
  setClothingCatalog: (catalog: ClothingItem[]) => void
) => {
  try {
    const params = new URLSearchParams({ action: 'list' });
    if (selectedCategories.length > 0) {
      params.append('categories', selectedCategories.join(','));
    }
    if (selectedColors.length > 0) {
      params.append('colors', selectedColors.join(','));
    }
    if (selectedArchetypes.length > 0) {
      params.append('archetypes', selectedArchetypes.join(','));
    }
    
    const response = await fetch(`${CATALOG_API}?${params.toString()}`);
    if (response.ok) {
      const data = await response.json();
      setClothingCatalog(data);
    }
  } catch (error) {
    console.error('Failed to fetch catalog:', error);
  }
};

export const fetchLookbooks = async (
  userId: string | undefined,
  setLookbooks: (lookbooks: any[]) => void
) => {
  if (!userId) return;
  
  try {
    const response = await fetch('https://functions.poehali.dev/69de81d7-5596-4e1d-bbd3-4b3e1a520d6b', {
      headers: {
        'X-User-Id': userId
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      setLookbooks(data);
    }
  } catch (error) {
    console.error('Failed to fetch lookbooks:', error);
  }
};
