import { useQuery, useQueryClient } from '@tanstack/react-query';

const CATALOG_API = 'https://functions.poehali.dev/e65f7df8-0a43-4921-8dbd-3dc0587255cc';

export interface ClothingItem {
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

export interface FilterOption {
  id: number | string;
  name: string;
}

export interface Filters {
  categories: FilterOption[];
  colors: FilterOption[];
  archetypes: FilterOption[];
  genders: FilterOption[];
}

interface CatalogFilters {
  categoryIds?: number[];
  colorIds?: number[];
  archetypeIds?: number[];
  gender?: string;
  excludeCategories?: string[];
  includeReplicateCategories?: string[];
}

const fetchFilters = async (): Promise<Filters> => {
  try {
    const response = await fetch(`${CATALOG_API}?action=filters`);
    if (!response.ok) {
      throw new Error('Failed to fetch filters');
    }
    const data = await response.json();
    // Ensure all arrays exist
    return {
      categories: data.categories || [],
      colors: data.colors || [],
      archetypes: data.archetypes || [],
      genders: data.genders || [],
    };
  } catch (error) {
    console.error('Filters fetch error:', error);
    // Return empty filters on error
    return { categories: [], colors: [], archetypes: [], genders: [] };
  }
};

const fetchAllClothingItems = async (): Promise<ClothingItem[]> => {
  try {
    const response = await fetch(`${CATALOG_API}?action=list`);
    if (!response.ok) {
      throw new Error('Failed to fetch catalog');
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Catalog fetch error:', error);
    return [];
  }
};

const filterClothingItems = (
  items: ClothingItem[],
  filters: CatalogFilters,
  availableFilters?: Filters
): ClothingItem[] => {
  return items.filter((item) => {
    if (filters.categoryIds && filters.categoryIds.length > 0 && availableFilters?.categories && availableFilters.categories.length > 0) {
      const selectedCategoryNames = availableFilters.categories
        .filter(cat => filters.categoryIds!.includes(Number(cat.id)))
        .map(cat => cat.name);
      
      const hasCategory = item.categories.some(cat => 
        selectedCategoryNames.includes(cat)
      );
      if (!hasCategory) return false;
    }

    if (filters.colorIds && filters.colorIds.length > 0 && availableFilters?.colors && availableFilters.colors.length > 0) {
      const selectedColorNames = availableFilters.colors
        .filter(col => filters.colorIds!.includes(Number(col.id)))
        .map(col => col.name);
      
      const hasColor = item.colors.some(col => 
        selectedColorNames.includes(col)
      );
      if (!hasColor) return false;
    }

    if (filters.archetypeIds && filters.archetypeIds.length > 0 && availableFilters?.archetypes && availableFilters.archetypes.length > 0) {
      const selectedArchetypeNames = availableFilters.archetypes
        .filter(arch => filters.archetypeIds!.includes(Number(arch.id)))
        .map(arch => arch.name);
      
      const hasArchetype = item.archetypes.some(arch => 
        selectedArchetypeNames.includes(arch)
      );
      if (!hasArchetype) return false;
    }

    if (filters.gender && filters.gender !== '') {
      if (item.gender !== filters.gender && item.gender !== 'unisex') {
        return false;
      }
    }

    if (filters.excludeCategories && filters.excludeCategories.length > 0) {
      const hasExcludedCategory = item.categories.some(cat => 
        filters.excludeCategories!.includes(cat)
      );
      if (hasExcludedCategory) return false;
    }

    if (filters.includeReplicateCategories && filters.includeReplicateCategories.length > 0) {
      if (!item.replicate_category || !filters.includeReplicateCategories.includes(item.replicate_category)) {
        return false;
      }
    }

    return true;
  });
};

export const useCatalogFilters = (excludeCategories?: string[]) => {
  return useQuery({
    queryKey: ['catalog-filters'],
    queryFn: async () => {
      const filters = await fetchFilters();
      
      // Ensure all arrays exist with defaults
      const safeFilters: Filters = {
        categories: filters.categories || [],
        colors: filters.colors || [],
        archetypes: filters.archetypes || [],
        genders: filters.genders || [],
      };
      
      if (excludeCategories && excludeCategories.length > 0) {
        safeFilters.categories = safeFilters.categories.filter(
          (cat) => !excludeCategories.includes(cat.name)
        );
      }
      return safeFilters;
    },
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
};

export const useCatalog = (filters?: CatalogFilters) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['catalog-items'],
    queryFn: fetchAllClothingItems,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const { data: availableFilters } = useQuery({
    queryKey: ['catalog-filters'],
    queryFn: fetchFilters,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const filteredItems = query.data && filters 
    ? filterClothingItems(query.data, filters, availableFilters)
    : query.data || [];

  const refetchCatalog = () => {
    return queryClient.invalidateQueries({ queryKey: ['catalog-items'] });
  };

  return {
    ...query,
    data: filteredItems,
    allItems: query.data || [],
    refetchCatalog,
  };
};